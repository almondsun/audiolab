#ifndef DSPLINK_PARAMS_H
#define DSPLINK_PARAMS_H

#include <stdbool.h>
#include <stdint.h>

#include "dsplink_bus.h"

typedef struct {
    bool write_ok;
    bool output_enabled;
    uint16_t core_control;
} dsplink_output_control_t;

typedef struct {
    bool write_ok;
    uint8_t gain_percent;
    uint32_t mixer_gain_q23;
    uint32_t mixer0_q23;
    uint32_t mixer1_q23;
    uint32_t mixer2_q23;
} dsplink_tsa1701_control_t;

dsplink_output_control_t dsplink_params_set_output_enabled(
        uint8_t address_7bit,
        bool enabled);
dsplink_tsa1701_control_t dsplink_params_set_tsa1701_controls(
        uint8_t address_7bit,
        uint8_t gain_percent,
        uint32_t mixer0_q23,
        uint32_t mixer1_q23,
        uint32_t mixer2_q23);

#endif
