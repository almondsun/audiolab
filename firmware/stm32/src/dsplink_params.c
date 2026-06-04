#include "dsplink_params.h"

#include <stdbool.h>
#include <stdint.h>

#include "dsplink_bus.h"

enum {
    DSPLINK_TSA1701_MIXER_GAIN_FIRST = 87U,
    DSPLINK_TSA1701_MIXER_GAIN_LAST = 92U,
    DSPLINK_SIGMA_5_23_ONE = 1UL << 23U
};

static uint32_t gain_q23_from_percent(uint8_t percent)
{
    if (percent > 100U) {
        percent = 100U;
    }

    return (DSPLINK_SIGMA_5_23_ONE * (uint32_t)percent + 50U) / 100U;
}

static uint32_t multiply_q23(uint32_t first, uint32_t second)
{
    return (uint32_t)(((uint64_t)first * (uint64_t)second
                      + (DSPLINK_SIGMA_5_23_ONE / 2U))
                     / DSPLINK_SIGMA_5_23_ONE);
}

static void safeload_data_to_bytes(uint32_t value, uint8_t out[5])
{
    out[0] = 0U;
    out[1] = (uint8_t)(value >> 24U);
    out[2] = (uint8_t)(value >> 16U);
    out[3] = (uint8_t)(value >> 8U);
    out[4] = (uint8_t)value;
}

static dsplink_bus_status_t safeload_parameter_q23(
        uint8_t address_7bit,
        uint16_t parameter_address,
        uint32_t value_q23)
{
    uint16_t core_control = 0U;
    uint8_t data[5];

    safeload_data_to_bytes(value_q23, data);

    if (dsplink_bus_adau1701_write_block(
                address_7bit,
                DSPLINK_ADAU1701_SAFELOAD_DATA0_REGISTER,
                data,
                (uint16_t)sizeof(data)) != DSPLINK_BUS_OK) {
        return DSPLINK_BUS_ERROR_TIMEOUT;
    }

    if (dsplink_bus_adau1701_write_u16(
                address_7bit,
                DSPLINK_ADAU1701_SAFELOAD_ADDRESS0_REGISTER,
                parameter_address) != DSPLINK_BUS_OK) {
        return DSPLINK_BUS_ERROR_TIMEOUT;
    }

    if (dsplink_bus_adau1701_read_u16(
                address_7bit,
                DSPLINK_ADAU1701_CORE_CONTROL_REGISTER,
                &core_control) != DSPLINK_BUS_OK) {
        return DSPLINK_BUS_ERROR_TIMEOUT;
    }

    return dsplink_bus_adau1701_write_u16(
            address_7bit,
            DSPLINK_ADAU1701_CORE_CONTROL_REGISTER,
            (uint16_t)(core_control | DSPLINK_ADAU1701_CORE_INITIATE_SAFELOAD));
}

dsplink_output_control_t dsplink_params_set_output_enabled(
        uint8_t address_7bit,
        bool enabled)
{
    uint16_t current = 0U;
    uint16_t updated;
    uint16_t verified = 0U;
    dsplink_output_control_t result = {false, false, 0U};
    const uint16_t pass_mask = DSPLINK_ADAU1701_CORE_ANALOG_PASS_MASK;

    if (dsplink_bus_adau1701_read_u16(
                address_7bit,
                DSPLINK_ADAU1701_CORE_CONTROL_REGISTER,
                &current) != DSPLINK_BUS_OK) {
        return result;
    }

    updated = enabled ? (uint16_t)(current | pass_mask)
                      : (uint16_t)(current & (uint16_t)~pass_mask);

    if (dsplink_bus_adau1701_write_u16(
                address_7bit,
                DSPLINK_ADAU1701_CORE_CONTROL_REGISTER,
                updated) != DSPLINK_BUS_OK) {
        return result;
    }

    if (dsplink_bus_adau1701_read_u16(
                address_7bit,
                DSPLINK_ADAU1701_CORE_CONTROL_REGISTER,
                &verified) != DSPLINK_BUS_OK) {
        return result;
    }

    result.core_control = verified;
    result.output_enabled = (verified & pass_mask) == pass_mask;
    result.write_ok = enabled ? result.output_enabled : ((verified & pass_mask) == 0U);
    return result;
}

dsplink_tsa1701_control_t dsplink_params_set_tsa1701_controls(
        uint8_t address_7bit,
        uint8_t gain_percent,
        uint32_t mixer0_q23,
        uint32_t mixer1_q23,
        uint32_t mixer2_q23)
{
    uint16_t parameter;
    uint32_t mixer_gain[3];
    dsplink_tsa1701_control_t result = {false, 0U, 0U, 0U, 0U, 0U};

    if (gain_percent > 100U) {
        gain_percent = 100U;
    }

    result.gain_percent = gain_percent;
    result.mixer_gain_q23 = gain_q23_from_percent(gain_percent);
    result.mixer0_q23 = multiply_q23(result.mixer_gain_q23, mixer0_q23);
    result.mixer1_q23 = multiply_q23(result.mixer_gain_q23, mixer1_q23);
    result.mixer2_q23 = multiply_q23(result.mixer_gain_q23, mixer2_q23);

    mixer_gain[0] = result.mixer0_q23;
    mixer_gain[1] = result.mixer1_q23;
    mixer_gain[2] = result.mixer2_q23;

    for (parameter = DSPLINK_TSA1701_MIXER_GAIN_FIRST;
         parameter <= DSPLINK_TSA1701_MIXER_GAIN_LAST;
         ++parameter) {
        const uint8_t mixer_index =
                (uint8_t)((parameter - DSPLINK_TSA1701_MIXER_GAIN_FIRST) % 3U);

        if (safeload_parameter_q23(
                    address_7bit,
                    parameter,
                    mixer_gain[mixer_index]) != DSPLINK_BUS_OK) {
            return result;
        }
    }

    result.write_ok = true;
    return result;
}
