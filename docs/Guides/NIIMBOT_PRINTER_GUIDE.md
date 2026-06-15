# NIIMBOT Printer Support

## Quick Start - Print in 30 Seconds!

**No configuration required for USB or Bluetooth printing!** Just follow these steps:

### USB Printing (Desktop/Laptop)
1. Plug your NIIMBOT printer into your computer via USB
2. Turn on the printer
3. In Nestarr, navigate to any **Location** or **Item**
4. Click the **"🖨️ Print Label"** button
5. Select **"USB"** as the connection method
6. Click **"Direct Print"** and select your printer when prompted

### Bluetooth Printing (Mobile/Laptop)
1. Turn on your NIIMBOT printer (it will be discoverable)
2. In Nestarr, navigate to any **Location** or **Item**
3. Click the **"🖨️ Print Label"** button
4. Select **"Bluetooth"** as the connection method
5. Click **"Direct Print"** and pair with your printer when prompted

> **That's it!** No User Settings configuration needed for USB or Bluetooth printing.

---

## Where to Find Print Buttons

Print labels are accessible from multiple locations in Nestarr:

### Locations
- **Location Cards**: Each location card has a "🖨️ Print Label" button
- **Location Details Modal**: Click the gear icon on any location, then use the "🖨️ Print Label" button in the header
- **Browse Locations Header**: When viewing a location, the "🖨️ Print Location" button appears in the header

### Items
- **Item Details View**: Open any item and click the "🖨️ Print Label" button in the action bar

---

## Overview

Nestarr supports thermal printing to NIIMBOT label printers. Multiple models are supported with automatic configuration based on your printer selection.

## Supported Hardware

| Model | Resolution | Print Width | Label Direction |
|-------|------------|-------------|-----------------|
| D11-H | 300 DPI | 136px (12mm) | Left |
| D101 | 203 DPI | 192px (24mm) | Left |
| D110 | 203 DPI | 96px (12mm) | Left |
| D110-M | 203 DPI | 96px (12mm) | Left |
| B1 | 203 DPI | 384px (48mm) | Top |
| B21 | 203 DPI | 384px (48mm) | Top |
| B21 Pro | 300 DPI | 591px (50mm) | Top |
| B21-C2B | 203 DPI | 384px (48mm) | Top |
| M2-H | 300 DPI | 591px (50mm) | Top |

**Connection**: USB or Bluetooth (all models)

> **Community Resource**: For detailed technical specifications, see the [NIIMBOT Community Wiki](https://printers.niim.blue/hardware/models/)

---

## Connection Methods

Nestarr offers three ways to print:

### 1. USB Direct (Recommended for Desktop)
- Printer plugged into your local computer
- Uses Web Serial API (Chrome, Edge, Opera)
- **No server configuration needed**
- Best for: Desktop/Laptop users

### 2. Bluetooth Direct (Recommended for Mobile)
- Printer connects wirelessly to your device
- Uses Web Bluetooth API (Chrome, Edge, Opera; Android only for mobile)
- **No server configuration needed**
- Best for: Mobile users, laptops without USB

### 3. Server NIIMBOT (Advanced)
- NIIMBOT printer connected to the Nestarr server
- Requires configuration in User Settings
- Works from any device/browser
- Best for: Shared NIIMBOT printers, multiple users

### 4. System Printer (CUPS)
- Print to any printer configured on the server via CUPS
- Works with standard label printers, inkjets, laser printers
- Requires CUPS running on host with socket mounted in Docker
- Best for: Existing office printers, standard label printers

---

## System Printer Setup (CUPS)

If you want to print to standard printers (not NIIMBOT) configured on your server, you can use the CUPS integration.

### Prerequisites
1. CUPS installed and running on your host system
2. Printer configured in CUPS (via `http://localhost:631` web interface)
3. Docker container has access to CUPS socket

### Docker Configuration

Add this volume mount to your `docker-compose.yml`:

```yaml
volumes:
  - /var/run/cups/cups.sock:/var/run/cups/cups.sock
```

### Usage

1. In Nestarr, click **"Print Label"** on any location or item
2. Select **"System Printer (CUPS)"** as the connection method
3. Choose your printer from the dropdown
4. Click **"Print to System"**

### Troubleshooting

- **"CUPS not available"**: Ensure CUPS is running (`systemctl status cups`) and the socket is mounted
- **No printers shown**: Check that printers are configured in CUPS (`lpstat -p`)
- **Permission denied**: Ensure the container user has access to the CUPS socket

---

## Advanced: Server-Side NIIMBOT Printing Setup

> **Note**: Only configure this if you want to share a printer connected to your server with all users.

### 1. Connect Printer to Server

**USB:**
- Plug the printer into the server
- The system will auto-detect the port (e.g., `/dev/ttyACM0` on Linux)

**Bluetooth:**
- Pair the printer with your server's OS first
- Find the MAC address (e.g., `AA:BB:CC:DD:EE:FF`)
- **Linux Tip:** If connection times out, run `bluetoothctl disconnect <MAC>` to clear stale sessions

### 2. Configure in User Settings

1. Click your profile icon → **User Settings**
2. Go to the **🖨️ Printer** tab
3. Scroll to "Server-Side Printer Configuration"
4. Check **Enable Server Printer**
5. Set **Printer Model** to your NIIMBOT model (e.g., D11-H, D101, B21)
6. Choose **Connection Type**: `USB` or `Bluetooth`
7. For Bluetooth, enter the **MAC Address**
8. Click **Test Server Connection** to verify
9. Click **Save Configuration**

### 3. Print via Server

1. Navigate to a location or item
2. Click **🖨️ Print Label**
3. Select **"Server Printer (Recommended)"** as connection method
4. Click **"Send to Server"**

---

## Browser Compatibility

| Browser | USB Direct | Bluetooth | Server Print |
|---------|-----------|-----------|--------------|
| Chrome/Edge (Desktop) | ✅ | ✅ | ✅ |
| Chrome (Android) | ❌ | ✅ | ✅ |
| Firefox | ❌ | ❌ | ✅ |
| Safari | ❌ | ❌ | ✅ |
| Safari (iOS) | ❌ | ❌ | ✅ |

> **Tip**: If USB or Bluetooth isn't available in your browser, use Server Printing instead.

---

## Troubleshooting

### "BLE connection timed out" or "Device not found"
1. **Power**: Ensure the printer is turned on and not in sleep mode
2. **Distance**: Move closer to the printer (within 10 feet)
3. **Restart Bluetooth**: Turn Bluetooth off and on again on your device
4. **For Server**: Run `bluetoothctl disconnect <MAC>` to clear stale connections

### USB Printer Not Detected
1. **Cable**: Try a different USB cable
2. **Port**: Try a different USB port
3. **Drivers**: No special drivers needed - just ensure the printer is on
4. **Browser**: Make sure you're using Chrome, Edge, or Opera

### Blank Labels
- Ensure labels are loaded correctly (thermal side facing the print head)
- Verify your label size matches the selected printer model
- Check that the correct **Printer Model** is selected in settings (for server mode)

### Server Connection Issues (Linux)
- The user running Nestarr must be in the `dialout` and `lp` groups
- For Docker, ensure the container has access to `/dev` and `/var/run/dbus`

---

## Technical Details

- **Protocol**: NIIMBOT V5 Protocol (most models), Legacy protocol (B1, B21)
- **Resolution**: Model-dependent (203 DPI or 300 DPI)
- **Backend**: Custom driver at `backend/app/niimbot/`
- **Frontend**: Web Serial/Bluetooth APIs at `src/lib/niimbot.ts`
- **API Endpoints**: `/api/printer/*`

## Credits

Based on reverse-engineering of the Niimbot protocol. Resources:
- [NIIMBOT Community Wiki](https://printers.niim.blue/) - Protocol documentation and model specs
- [niimblue](https://github.com/kallanreed/niimblue) - Web-based printing tool
- [hass-niimbot](https://github.com/custom-components/niimbot) - Home Assistant integration
