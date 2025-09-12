#################################################################################
"""
OpenEO Module: Load Management
A simple module implementing solar and site load management

"""
#################################################################################

import logging
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
            return globalState.stateDict["eo_current_solar"] - self.pluginConfig.get("solar_reservation_current",1)
        else:
            return 0

    def get_user_settings(self):
        settings = []
        util.add_simple_setting(self.pluginConfig, settings, 'boolean', "loadmanagement", ("solar_enable",), 'Solar Charging Enabled', \
            note="This setting will allow openeo to charge, regardless of whether the manual or schedule mode is enabled", default=False)
        util.add_simple_setting(self.pluginConfig, settings, 'slider', "loadmanagement", ("solar_reservation_current",), 'Solar Reservation Current', \
            note="Solar charging will be reduced by this number of amps to reserve some capacity for site base load.", \
            range=(0,8), default=1, value_unit="A")
        util.add_simple_setting(self.pluginConfig, settings, 'slider', "loadmanagement", ("site_limit_current",), 'Maximum Site Consumption', \
            note="When a current sensor is installed on the site electrical feed, setting this value may restrict charger output if electricity consumption measured at the sensor is high.", \
            range=(1,100), default=60, value_unit="A")
        util.add_simple_setting(self.pluginConfig, settings, 'boolean', "loadmanagement", ("solar_topup_enable",), 'Enable Solar Cloud Top-up', \
            note="When solar briefly drops (e.g. clouds), automatically top-up to minimum current using grid to avoid session stop.", default=True)
        util.add_simple_setting(self.pluginConfig, settings, 'slider', "loadmanagement", ("solar_topup_min_current",), 'Top-up Minimum Current', \
            note="Minimum charging current to maintain during brief solar dips.", \
            range=(6,16), default=6, value_unit="A")
        util.add_simple_setting(self.pluginConfig, settings, 'slider', "loadmanagement", ("solar_topup_recent_window_s",), 'Top-up Grace Window (s)', \
            note="How long after last solar surplus to keep top-up active before stopping at 0A (prevents grid use at night).", \
            range=(30,1800), default=300, value_unit="s")
        return settings
