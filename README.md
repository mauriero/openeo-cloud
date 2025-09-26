# openeo-cloud
# Modified code for EV charger EO Mini Pro 2 which allows mains top-up to minimum current when clouds cover solar panels and a selectable charging percentage target.
This project is an alternative to the solution provided by **openeo** developers and contributors for those who wish to charge to a preset percentage and who wish to top-up solar current to a minimum of 6A from the mains instead of stopping charging when clouds reduce solar output. It aims to provide an alternative, open source software that can be directly installed on the EO Mini Pro 2 to allow control from the local WiFi network without the use of the EO server.

# Compatibility
This project has been designed to be compatible with the EO Mini Pro 2 device. It does not support Mini Pro 3.

<p align="center">
<img width="404" height="274" alt="EO Mini Pro 2" src="https://github.com/user-attachments/assets/928d5924-f901-4c4d-b1e9-aec887543ec0" />
</p> 

<p align="center">
EO Mini Pro 2
</p>

# Install Instructions
This software can be installed onto a Raspberry OS Lite install. We recommend that you keep your original EO SD card safe and separate, so that you can revert easily, should things don't work out for you.

1.  Obtain a 8GB (or larger) micro SD card

2.  Flash the SD card with the Raspberry PI imager (Device: Raspberry Pi Zero, Operating System: Raspberry PI OS Lite (32 bit)

<p align="center">
<img width="468" height="294" alt="Raspbpi" src="https://github.com/user-attachments/assets/c62055ef-a389-4d8e-aa0e-ece564aebbbb" />
</p>

3.  In the Raspberry PI imager "General" settings - set your Hostname, Username/Password, Wirelss LAN and Locale settings as appropriate. There are no restrictions on what to set your hostname, but you must create a user of "pi"

<p align="center">
<img width="289" height="417" alt="Services" src="https://github.com/user-attachments/assets/8385b5b1-d6d4-4dec-88a8-9c2c9ee629f9" />
</p>

4.  In the Raspberry PI imager "Services" settings - ensure that SSH is enabled, and I would recommend that public-key authentication is enabled, and you should add your SSH public key as approprate. Alternatively, you may use a secure password, but be aware anyone with that password will be able to access the Raspberry Pi device, so choose a unique one and don't put it on a post-it note.

<p align="center">
<img width="374" height="252" alt="Enable SSH" src="https://github.com/user-attachments/assets/7ccec0f7-4481-40bf-92fc-82d02d057ec7" />
</p>

5. IMPORTANT Once the new SD card has been created, remove power to your EO box by disconnecting it or by switching off the relevant breaker in your consumer unit. **Please ensure that it is completely isolated from the mains electricity. If you are unsure that the electricity is fully disconnected, then do not proceed.**

6.  Open the Mini Pro 2 box by loosening the four captive screws that are visible on the front of the case (you may need to remove the four rubber covers, if they are fitted), and you will see the Raspberry Pi Zero inside. You can now switch the SD cards, keeping the original safe. Whilst you are doing this take care to not accidentally dislodge the cables connecting the Raspberry Pi board with the main control board in the lid of the unit.

7. Close the EO enclosure, and apply power to it. The Raspberry Pi should boot, and if you got the configuration correct in step #3 above, it will then join your wireless network and you can log in with SSH (you should be able to find the RPi IP address from your broadband router). Note that the first time that you power up with a fresh SD card, it will take about five minutes to fully boot before it is seen on the network.
 
8. Log onto your account on the RPi via SSH (e.g. using PuTTY) over the WiFi network, and run the following commands. This will download the software from GitHub and run the installation process, then reboots your RPi to allow the software to finish configuring and start up.

```
curl -sSL https://raw.githubusercontent.com/mauriero/openeo-cloud/main/openeo_download.py | python3 -
sudo reboot
```

Once the Raspberry Pi reboots, it should all be working. You should be able to point your browser at the IP address (or you can use mDNS to navigate to hostname.local in a web browser - where hostname is whichever hostname you set in step 3 above). You should see one of the Home screens.  

On the Home screen there are 2 modes, **Manual** and **Schedule:**

<p align="center">
<img width="582" height="378" alt="Home Screens" src="https://github.com/user-attachments/assets/c71fd184-3dae-4a74-a6bc-ecf965973fff" />
</p>

**Manual Mode** - Turns the charger off and on.

**Schedule Mode** – Set a charging schedule for your off-peak hours. Set an initial state of charge (SOC), read from your car, by clicking on the Initial SOC number and entering the percentage in the box that appears.  Current SOC keeps track of your car’s charge status in real time estimated from your EV battery capacity adjustable on the Settings page.  The charger stops when a preset percentage (in **Settings**) is reached, or it is the end of the schedule.  If the Initial SOC is set to zero, the car charges to the end of the schedule.

**Settings screen - Site and Solar Load management**

<p align="center">
<img width="391" height="570" alt="Settings Screen" src="https://github.com/user-attachments/assets/d35b2331-b7b8-4eac-b7f1-b8d29f05659a" />
</p>

**Solar Charging Enabled** – When set to No the bottom four lines disappear.  Select this if there is no solar installation or no solar CT fitted.

**Maximum Site Consumption** - This is the maximum current the site can import or export governed by the site fuse. EV charging rate will be reduced to accommodate this maximum if there is a mains CT fitted.

**EV Battery Capacity** – This is entered according to the EV on charge. A starting point is to set it at the manufacturer’s stated capacity reduced by the battery’s known state of health (SOH).  Adjust this if the car reaches a different SOC than selected below. Make it smaller if the car charge is greater than the selected value and vice versa.

**End Charging at** – This can be set to a nominated value if charging is to stop before 100% is reached.  

**Solar Charging Enabled** – When set to Yes the bottom four lines appear.

**Solar Reservation Current** – This is the current you estimate your house is going to need delivered from solar while your car is charging. The car will charge at the solar current minus this setting.

**Mains Cloud Top-up** – When set to No the car charger will follow the solar current profile but will stop charging if the solar current falls below 6A plus Solar Reservation Current.  If there are a number of clouds this can result in multiple charging sessions per day.
When set to Yes the car will start charging when the solar output reaches Solar Reservation Current plus Top-up Minimum Current and continue to charge, drawing the current needed to top up from the mains supply.

**Top-up Minimum Current** – When solar power falls below this plus Solar Reservation Current power is imported to keep the car charging at a minimum of 6A.

**End Solar Charging at** – This is a setting which stops the charger when the solar power falls below charging levels at the end of the day.

**Statistics screen** – This is unchanged from **openeo v0.5.4**

## Disclaimer
The software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.   Please see the important terms and conditions in the `LICENSE.txt` file.   The software has been developed by clean-room reverse engineering of the existing EO software and no copyrighted EO code is used in this application.  
