#################################################################################
"""
OpenEO Module: Load Management
A simple module implementing solar and site load management

"""
#################################################################################

import logging, datetime
from lib.PluginSuperClass import PluginSuperClass
import util
import globalState


# logging for use in this module
_LOGGER = logging.getLogger(__name__)

#################################################################################
class loadmanagementClassPlugin(PluginSuperClass):
    PRETTY_NAME = "Site and Solar Load Management"
    CORE_PLUGIN = True  
    pluginParamSpec={	
            "enabled":	{"type": "bool","default": True},
			"solar_enable":	{"type": "bool", "default":False},
			"solar_reservation_current":	{"type": "int", "default": 1},
			"site_limit_current":	{"type": "int", "default": 60},
            "solar_topup_enable":    {"type": "bool", "default": True},
            "solar_topup_min_current": {"type": "int", "default": 6},
            "solar_topup_recent_window_s": {"type": "int", "default": 300},
            "solar_topup_end_time": {"type": "str", "default": "16:00"},
            "ev_battery_capacity_kwh": {"type": "int", "default": 40},
            "end_soc_pct": {"type": "int", "default": 80},
            "simulate_ct_solar":    {"type": "float", "default": 0.0},
            "simulate_ct_site":     {"type": "float", "default": 0.0},
            "ct_calibration_site":   {"type": "float", "default": 1.0},
            "ct_calibration_vehicle":{"type": "float", "default": 1.0},
            "ct_calibration_solar":  {"type": "float", "default": 1.0},
            "ct_offset_site":   {"type": "float", "default": 0.0},
            "ct_offset_vehicle":{"type": "float", "default": 0.0},
            "ct_offset_solar":  {"type": "float", "default": 0.0}
            }
        
    def poll(self):
        if (self.pluginConfig.get("solar_enable",False)):
            # Respect end-of-day cut-off for solar charging
            try:
                end_str = self.pluginConfig.get("solar_topup_end_time","16:00")
                end_t = datetime.time(int(end_str[:2]), int(end_str[-2:]), 0, 0)
                now = datetime.datetime.now().time()
                if now > end_t:
                    return 0
            except Exception:
                pass
            return globalState.stateDict["eo_current_solar"] - self.pluginConfig.get("solar_reservation_current",1)
        else:
            return 0

    def get_user_settings(self):
        settings = []
        util.add_simple_setting(self.pluginConfig, settings, 'boolean', "loadmanagement", ("solar_enable",), 'Solar Charging Enabled', \
            note="This setting will allow openeo to charge, regardless of whether the manual or schedule mode is enabled", default=False)
        util.add_simple_setting(self.pluginConfig, settings, 'slider', "loadmanagement", ("site_limit_current",), 'Maximum Site Consumption', \
            note="When a current sensor is installed on the site electrical feed, setting this value may restrict charger output if electricity consumption measured at the sensor is high.", \
            range=(1,100), default=60, value_unit="A")

        if self.pluginConfig.get("solar_enable", False):
            util.add_simple_setting(self.pluginConfig, settings, 'slider', "loadmanagement", ("solar_reservation_current",), 'Solar Reservation Current', \
                note="Solar charging will be reduced by this number of amps to reserve some capacity for site base load.", \
                range=(0,8), default=1, value_unit="A")

            util.add_simple_setting(self.pluginConfig, settings, 'slider', "loadmanagement", ("ev_battery_capacity_kwh",), 'EV Battery Capacity kWh', \
                note="Estimated usable capacity of your EV battery.", range=(10,100), default=40, value_unit="kWh")
            util.add_simple_setting(self.pluginConfig, settings, 'slider', "loadmanagement", ("end_soc_pct",), 'End Charging at %', \
                note="Target state-of-charge to stop at if reached before schedule end.", range=(50,100), step=5, default=100, value_unit="%")

            util.add_simple_setting(self.pluginConfig, settings, 'boolean', "loadmanagement", ("solar_topup_enable",), 'Enable Mains Cloud Top-up', \
                note="When solar briefly drops (e.g. clouds), use grid to maintain a minimum current until the configured daytime cut-off.", default=True)
            util.add_simple_setting(self.pluginConfig, settings, 'slider', "loadmanagement", ("solar_topup_min_current",), 'Top-up Minimum Current', \
                note="Minimum charging current to maintain during brief solar dips.", \
                range=(6,16), default=6, value_unit="A")
            util.add_simple_setting(self.pluginConfig, settings, 'slider', "loadmanagement", ("solar_topup_end_time",), 'End Solar Charging at', \
                note="End-of-day cut-off for solar charging and top-up (HHMM).", range=(1000,2200), step=30, default=1600)

        return settings
