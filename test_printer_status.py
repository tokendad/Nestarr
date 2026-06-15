#!/usr/bin/env python3
"""
Test script for printer status checking.
Tests the new heartbeat() and check_printer_ready() functionality.
"""

import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from app.niimbot.printer import PrinterClient, SerialTransport, BleakTransport, RfcommTransport

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s | %(message)s'
)

def test_printer_status(address: str, connection_type: str = "rfcomm"):
    """Test printer status checking."""

    print("=" * 70)
    print("PRINTER STATUS CHECK TEST")
    print("=" * 70)
    print(f"Address: {address}")
    print(f"Connection Type: {connection_type}")
    print()

    # Create transport
    print("📡 Creating transport...")
    if connection_type == "rfcomm":
        transport = RfcommTransport(address)
    elif connection_type == "ble":
        transport = BleakTransport(address)
    elif connection_type == "serial":
        transport = SerialTransport(address)
    else:
        print(f"❌ Unknown connection type: {connection_type}")
        return

    printer = PrinterClient(transport)

    try:
        # Connect
        print("🔌 Connecting to printer...")
        if not printer.connect():
            print("❌ Failed to connect to printer")
            return
        print("✅ Connected successfully")
        print()

        # Test heartbeat
        print("💓 Testing heartbeat command...")
        try:
            status = printer.heartbeat()
            print("✅ Heartbeat successful!")
            print()
            print("📊 Printer Status:")
            print(f"   • Cover State:    {status['closingstate']} {'' if status['closingstate'] is None else '(0=open, 1=closed)'}")
            print(f"   • Paper State:    {status['paperstate']} {'' if status['paperstate'] is None else '(0=none, 1=present)'}")
            print(f"   • Power Level:    {status['powerlevel']} {'' if status['powerlevel'] is None else '%'}")
            print(f"   • RFID State:     {status['rfidreadstate']}")
            print()
        except Exception as e:
            print(f"❌ Heartbeat failed: {e}")
            print()

        # Test check_printer_ready
        print("🔍 Testing check_printer_ready()...")
        try:
            ready, message = printer.check_printer_ready()
            if ready:
                print(f"✅ Printer is READY: {message}")
            else:
                print(f"❌ Printer NOT READY: {message}")
            print()
        except Exception as e:
            print(f"❌ check_printer_ready() failed: {e}")
            print()

        # Interpretation
        print("=" * 70)
        print("INTERPRETATION:")
        print("=" * 70)

        if status.get('closingstate') is not None:
            if status['closingstate'] == 0:
                print("⚠️  COVER IS OPEN - This will prevent printing")
            elif status['closingstate'] == 1:
                print("✅ Cover is closed")
        else:
            print("ℹ️  Cover state not available for this printer model")

        if status.get('paperstate') is not None:
            if status['paperstate'] == 0:
                print("⚠️  NO LABELS DETECTED - This will prevent printing")
            elif status['paperstate'] == 1:
                print("✅ Labels are present")
        else:
            print("ℹ️  Paper state not available for this printer model")

        if status.get('powerlevel') is not None:
            if status['powerlevel'] < 10:
                print(f"⚠️  LOW BATTERY ({status['powerlevel']}%) - This will prevent printing")
            else:
                print(f"✅ Battery OK ({status['powerlevel']}%)")
        else:
            print("ℹ️  Battery level not available for this printer model")

        print()

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("🔌 Disconnecting...")
        printer.disconnect()
        print("Done!")

if __name__ == "__main__":
    # Get printer config from user's settings if available
    import os
    import json

    # Try to read config from database
    try:
        from app.database import SessionLocal
        from app import models

        db = SessionLocal()
        # Get first user with printer configured
        user = db.query(models.User).filter(
            models.User.niimbot_printer_config.isnot(None)
        ).first()

        if user and user.niimbot_printer_config:
            config = user.niimbot_printer_config
            address = config.get("address", "03:01:08:82:81:4D")
            conn_type = config.get("connection_type", "rfcomm")

            if config.get("bluetooth_type"):
                conn_type = config["bluetooth_type"]

            print(f"Using config from database: {address} ({conn_type})")
            test_printer_status(address, conn_type)
        else:
            print("No printer configuration found in database")
            print("Using default: 03:01:08:82:81:4D (rfcomm)")
            test_printer_status("03:01:08:82:81:4D", "rfcomm")

        db.close()
    except Exception as e:
        print(f"Could not read from database: {e}")
        print("Using default: 03:01:08:82:81:4D (rfcomm)")
        test_printer_status("03:01:08:82:81:4D", "rfcomm")
