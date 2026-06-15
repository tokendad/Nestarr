# Windows LPD Printing Guide for Docker

This guide explains how to enable printing from Nestarr running in Docker to printers connected to a Windows host.

## The Challenge

When Nestarr runs in a Docker container (Linux-based), it cannot directly access printers connected to the Windows host. This is because:

1. Docker containers are isolated from the host system
2. Linux containers cannot communicate with the Windows Print Spooler
3. USB passthrough from Windows to Linux containers is complex

## The Solution: LPD Print Service

The Line Printer Daemon (LPD) protocol allows network printing from the Docker container to the Windows host.

### How It Works

```
Nestarr (Docker) → LPD Protocol → Windows LPD Service → Printer
```

---

## Step-by-Step Setup

### Step 1: Enable LPD Print Service on Windows

1. Open **Control Panel**
2. Go to **Programs** → **Programs and Features**
3. Click **Turn Windows features on or off**
4. Expand **Print and Document Services**
5. Check **LPD Print Service**
6. Click **OK** and wait for installation
7. **Restart your computer**

### Step 2: Share Your Printer

1. Open **Settings** → **Devices** → **Printers & scanners**
2. Select your printer
3. Click **Manage** → **Printer properties**
4. Go to the **Sharing** tab
5. Check **Share this printer**
6. Note the **Share name** (e.g., `HP_Printer`)

### Step 3: Find Your Windows IP Address

1. Open Command Prompt
2. Run: `ipconfig`
3. Find your IPv4 address (e.g., `192.168.1.100`)

### Step 4: Configure Nestarr

In Nestarr's printer settings, configure the server printer to use the LPD network address:

- **Connection Type**: Network/LPD
- **Address**: `lpd://192.168.1.100/HP_Printer`
  - Replace `192.168.1.100` with your Windows IP
  - Replace `HP_Printer` with your share name

---

## Troubleshooting

### LPD Service Not Starting

1. Open **Services** (services.msc)
2. Find **LPD Service**
3. Ensure it's set to **Automatic**
4. Click **Start** if not running

### Firewall Blocking Connections

LPD uses port 515. Ensure it's open:

1. Open **Windows Defender Firewall**
2. Click **Advanced settings**
3. Add an **Inbound Rule** for port **515 TCP**

### Cannot Find Printer

- Verify the printer share name matches exactly (case-sensitive)
- Ensure the printer is shared and online
- Test from another Windows computer first

### Docker Network Issues

If using Docker Desktop, ensure the container can reach your host:

1. Use `host.docker.internal` instead of your IP address
2. Or configure Docker network mode appropriately

---

## Alternative: PDF Printing

If LPD setup is too complex, consider using PDF printing:

1. Install a PDF printer on Windows (e.g., Microsoft Print to PDF)
2. Share it via LPD
3. Nestarr sends print jobs as PDF
4. You can then print the PDF from Windows

---

## Future Improvements

We're working on simpler solutions including:

- Direct CUPS integration for Linux hosts
- Web-based print dialog using browser's native print
- Improved USB passthrough for Windows Docker Desktop

---

## Support

If you encounter issues:

1. Check the [NIIMBOT Printer Guide](NIIMBOT_PRINTER_GUIDE.md) for direct USB/Bluetooth printing (no Docker complications)
2. Report issues at [GitHub Issues](https://github.com/tokendad/Nestarr/issues)
