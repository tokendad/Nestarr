"""
Network Discovery — scan the local network with nmap and import found devices as inventory items.

Admin-only endpoints. Requires nmap to be installed on the host (included in Dockerfile).
For MAC address collection, the container must run with --cap-add=NET_RAW or equivalent.
Without NET_RAW the scan degrades gracefully: returns IP/hostname only, no MAC/vendor.
"""
import asyncio
import ipaddress
import re
import socket
import time
from typing import Optional

SCAN_TIMEOUT_SECONDS = 90

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..deps import get_db

router = APIRouter(prefix="/network", tags=["network"])

# Allowlist CIDR pattern to prevent nmap injection
_CIDR_RE = re.compile(
    r"^(\d{1,3}\.){3}\d{1,3}/\d{1,2}$"
)


def _require_admin(current_user: models.User = Depends(auth.get_current_user)) -> models.User:
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can use network discovery")
    return current_user


def _auto_detect_subnet() -> str:
    """Return the /24 CIDR of the host's primary outbound interface."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        net = ipaddress.ip_network(f"{local_ip}/24", strict=False)
        return str(net)
    except Exception:
        return "192.168.1.0/24"


def _guess_device_type(ports: list[int], services: list[str]) -> Optional[str]:
    port_set = set(ports)
    service_str = " ".join(services).lower()
    if 554 in port_set or "rtsp" in service_str:
        return "camera"
    if 8080 in port_set or 80 in port_set and 443 in port_set and 22 not in port_set:
        return "router"
    if 22 in port_set or 3389 in port_set or 5900 in port_set:
        return "computer"
    if 1883 in port_set or 8883 in port_set or "mqtt" in service_str:
        return "iot-device"
    if 9100 in port_set or "printer" in service_str or "ipp" in service_str:
        return "printer"
    if port_set:
        return "network-device"
    return None


def _scan_network(subnet: str) -> tuple[list[schemas.DiscoveredDevice], str]:
    """
    Run nmap against subnet. Returns (devices, method_used).
    Falls back gracefully if nmap is unavailable or privileges are insufficient.
    """
    try:
        import nmap  # python-nmap
    except ImportError:
        return [], "unavailable"

    nm = nmap.PortScanner()
    devices: list[schemas.DiscoveredDevice] = []

    try:
        # Phase 1: host discovery (no port scan)
        nm.scan(hosts=subnet, arguments="-sn -T4 --host-timeout 10s")
        live_hosts = nm.all_hosts()

        if not live_hosts:
            return [], "nmap"

        # Phase 2: quick service scan on live hosts
        host_str = " ".join(live_hosts)
        nm.scan(hosts=host_str, arguments="-sV --top-ports 20 -T4 --host-timeout 15s")
    except nmap.nmap.PortScannerError:
        return [], "nmap-error"

    for host in nm.all_hosts():
        h = nm[host]
        # MAC — only available with root/NET_RAW; nmap stores in addresses dict
        addresses = h.get("addresses", {})
        mac = addresses.get("mac") or None
        vendor_info = h.get("vendor", {})
        manufacturer = vendor_info.get(mac, None) if mac else None

        # Hostname
        hostnames = h.get("hostnames", [])
        hostname = hostnames[0].get("name") if hostnames else None
        if not hostname:
            hostname = None

        # OS guess (requires OS detection scan; may be empty without -O flag)
        osmatch = h.get("osmatch", [])
        os_guess = osmatch[0].get("name") if osmatch else None

        # Ports and services
        open_ports: list[int] = []
        services: list[str] = []
        for proto in h.all_protocols():
            for port, pdata in h[proto].items():
                if pdata.get("state") == "open":
                    open_ports.append(int(port))
                    svc = pdata.get("name") or ""
                    if svc and svc not in services:
                        services.append(svc)

        device_type = _guess_device_type(open_ports, services)

        devices.append(
            schemas.DiscoveredDevice(
                ip=host,
                mac=mac,
                hostname=hostname,
                manufacturer=manufacturer,
                os_guess=os_guess,
                open_ports=sorted(open_ports),
                services=services,
                device_type_guess=device_type,
            )
        )

    return devices, "nmap"


def _match_existing_items(
    devices: list[schemas.DiscoveredDevice], db: Session
) -> list[schemas.DiscoveredDevice]:
    """
    Populate existing_item_id/name for devices already in inventory.
    Primary match: MAC address (requires NET_RAW capability).
    Fallback match: IP address label in additional_info (works without NET_RAW,
    prevents duplicate imports on re-scan).
    """
    for device in devices:
        matched = False

        # Primary: MAC-based match
        if device.mac:
            mac_upper = device.mac.upper()
            rows = db.execute(
                text(
                    "SELECT id, name FROM items "
                    "WHERE additional_info LIKE :mac AND deleted_at IS NULL"
                ),
                {"mac": f"%{mac_upper}%"},
            ).fetchall()
            if rows:
                device.existing_item_id = str(rows[0][0])
                device.existing_item_name = rows[0][1]
                matched = True

        # Fallback: IP-based match (catches re-scans when MAC unavailable)
        if device.ip and not matched:
            rows = db.execute(
                text(
                    "SELECT id, name FROM items "
                    "WHERE additional_info LIKE :ip AND deleted_at IS NULL"
                ),
                {"ip": f"%IP Address%{device.ip}%"},
            ).fetchall()
            if rows:
                device.existing_item_id = str(rows[0][0])
                device.existing_item_name = rows[0][1]

    return devices


@router.post("/scan", response_model=schemas.NetworkScanResponse)
async def scan_network(
    req: schemas.NetworkScanRequest,
    _admin: models.User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """Scan the local network for connected devices (admin only)."""
    if req.subnet:
        # Validate CIDR to prevent injection into nmap args
        if not _CIDR_RE.match(req.subnet):
            raise HTTPException(status_code=400, detail="Invalid subnet format. Expected CIDR like 192.168.1.0/24")
        subnet = req.subnet
    else:
        subnet = _auto_detect_subnet()

    t0 = time.time()
    loop = asyncio.get_event_loop()
    try:
        devices, method = await asyncio.wait_for(
            loop.run_in_executor(None, _scan_network, subnet),
            timeout=SCAN_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        return schemas.NetworkScanResponse(
            subnet_scanned=subnet,
            scan_duration_seconds=round(time.time() - t0, 2),
            devices_found=0,
            devices=[],
            scan_method="timeout",
            error=(
                f"Scan timed out after {SCAN_TIMEOUT_SECONDS} seconds. "
                "Try specifying a smaller subnet (e.g. 192.168.1.0/24)."
            ),
        )
    duration = round(time.time() - t0, 2)

    if method not in ("nmap", "nmap-error"):
        return schemas.NetworkScanResponse(
            subnet_scanned=subnet,
            scan_duration_seconds=duration,
            devices_found=0,
            devices=[],
            scan_method=method,
            error="nmap is not available on this server. Ensure the Docker image was built with nmap installed.",
        )

    if method == "nmap-error":
        return schemas.NetworkScanResponse(
            subnet_scanned=subnet,
            scan_duration_seconds=duration,
            devices_found=0,
            devices=[],
            scan_method=method,
            error="nmap scan failed. The server may lack the NET_RAW capability required for this type of scan.",
        )

    devices = _match_existing_items(devices, db)

    return schemas.NetworkScanResponse(
        subnet_scanned=subnet,
        scan_duration_seconds=duration,
        devices_found=len(devices),
        devices=devices,
        scan_method=method,
    )


@router.post("/import", response_model=schemas.NetworkImportResponse)
def import_devices(
    req: schemas.NetworkImportRequest,
    current_user: models.User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """Import selected discovered devices as inventory items (admin only)."""
    created = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for entry in req.devices:
        dev = entry.device
        try:
            if entry.action == "skip":
                skipped += 1
                continue

            # Build additional_info entries for non-None values
            additional_info: list[dict] = []
            if dev.ip:
                additional_info.append({"label": "IP Address", "value": dev.ip})
            if dev.mac:
                additional_info.append({"label": "MAC Address", "value": dev.mac.upper()})
            if dev.open_ports:
                additional_info.append({"label": "Open Ports", "value": ", ".join(str(p) for p in dev.open_ports)})
            if dev.os_guess:
                additional_info.append({"label": "OS", "value": dev.os_guess})
            if dev.services:
                additional_info.append({"label": "Services", "value": ", ".join(dev.services)})

            # Per-device location override; fall back to request-level location
            effective_location_id = entry.location_id or req.location_id

            if entry.action == "create":
                name = (
                    entry.item_name
                    or dev.hostname
                    or f"Network Device ({dev.ip})"
                )
                description_parts = ["Discovered via network scan."]
                if dev.open_ports:
                    description_parts.append(f"Ports: {', '.join(str(p) for p in dev.open_ports)}")

                item = models.Item(
                    name=name,
                    brand=(dev.manufacturer or "")[:255] if dev.manufacturer else None,
                    model_number=dev.device_type_guess,
                    description=" ".join(description_parts),
                    location_id=effective_location_id,
                    additional_info=additional_info or None,
                    owner_id=current_user.id,
                )
                db.add(item)
                db.commit()
                db.refresh(item)
                created += 1

            elif entry.action == "update":
                if not entry.item_id:
                    errors.append(f"Update action for {dev.ip} missing item_id")
                    continue
                item = db.query(models.Item).filter(
                    models.Item.id == entry.item_id,
                    models.Item.deleted_at.is_(None),
                ).first()
                if not item:
                    errors.append(f"Item {entry.item_id} not found for update")
                    continue

                # Merge: update blank fields and merge additional_info
                if not item.brand and dev.manufacturer:
                    item.brand = dev.manufacturer[:255]
                if not item.model_number and dev.device_type_guess:
                    item.model_number = dev.device_type_guess

                existing_ai: list[dict] = item.additional_info or []
                existing_labels = {e.get("label") for e in existing_ai}
                for entry_ai in additional_info:
                    if entry_ai["label"] not in existing_labels:
                        existing_ai.append(entry_ai)
                item.additional_info = existing_ai or None

                db.commit()
                updated += 1

            else:
                errors.append(f"Unknown action '{entry.action}' for device {dev.ip}")

        except Exception as exc:
            errors.append(f"Error processing {dev.ip}: {exc}")
            db.rollback()

    return schemas.NetworkImportResponse(
        created=created,
        updated=updated,
        skipped=skipped,
        errors=errors,
    )
