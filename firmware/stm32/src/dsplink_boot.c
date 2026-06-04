#include "dsplink_boot.h"

#include <stdbool.h>
#include <stdint.h>

#include "dsplink_bus.h"
#include "tsa1701_default_firmware.h"

enum {
    ADAU1701_SELFBOOT_END = 0x00U,
    ADAU1701_SELFBOOT_WRITE = 0x01U,
    ADAU1701_SELFBOOT_DELAY = 0x02U,
    ADAU1701_SELFBOOT_NOOP = 0x03U,
    ADAU1701_SELFBOOT_SET_MULTIPLE_WRITEBACK = 0x04U,
    ADAU1701_SELFBOOT_SET_WRITEBACK_FALLING_EDGE = 0x05U,
    ADAU1701_SELFBOOT_END_AND_WAIT_WRITEBACK = 0x06U
};

static void boot_delay_spins(uint16_t delay)
{
    volatile uint32_t spins = (uint32_t)delay * 1000U;

    while (spins > 0U) {
        spins--;
    }
}

static bool load_adau1701_selfboot_image(uint8_t address_7bit)
{
    uint16_t offset = 0U;

    while (offset < tsa1701_default_firmware_length) {
        const uint8_t command = tsa1701_default_firmware[offset];
        offset++;

        if (command == ADAU1701_SELFBOOT_END) {
            return true;
        }

        if (command == ADAU1701_SELFBOOT_WRITE) {
            uint16_t length;
            uint16_t register_address;
            const uint8_t *body;

            if ((uint16_t)(tsa1701_default_firmware_length - offset) < 2U) {
                return false;
            }

            length = (uint16_t)(((uint16_t)tsa1701_default_firmware[offset] << 8U)
                                | tsa1701_default_firmware[offset + 1U]);
            offset = (uint16_t)(offset + 2U);

            if (((uint16_t)(tsa1701_default_firmware_length - offset) < length)
                    || (length < 3U)) {
                return false;
            }

            body = &tsa1701_default_firmware[offset];
            register_address = (uint16_t)(((uint16_t)body[1] << 8U) | body[2]);
            if (dsplink_bus_adau1701_write_block(
                        address_7bit,
                        register_address,
                        &body[3],
                        (uint16_t)(length - 3U)) != DSPLINK_BUS_OK) {
                return false;
            }
            offset = (uint16_t)(offset + length);
        } else if (command == ADAU1701_SELFBOOT_DELAY) {
            uint16_t delay;

            if ((uint16_t)(tsa1701_default_firmware_length - offset) < 2U) {
                return false;
            }

            delay = (uint16_t)(((uint16_t)tsa1701_default_firmware[offset] << 8U)
                               | tsa1701_default_firmware[offset + 1U]);
            offset = (uint16_t)(offset + 2U);
            boot_delay_spins(delay);
        } else if ((command == ADAU1701_SELFBOOT_NOOP)
                || (command == ADAU1701_SELFBOOT_SET_MULTIPLE_WRITEBACK)
                || (command == ADAU1701_SELFBOOT_SET_WRITEBACK_FALLING_EDGE)
                || (command == ADAU1701_SELFBOOT_END_AND_WAIT_WRITEBACK)) {
            if (command == ADAU1701_SELFBOOT_END_AND_WAIT_WRITEBACK) {
                return true;
            }
        } else {
            return false;
        }
    }

    return false;
}

void dsplink_boot_result_clear(dsplink_boot_result_t *result)
{
    if (result == 0) {
        return;
    }

    result->found = false;
    result->readback_ok = false;
    result->firmware_loaded = false;
    result->dac_config_ok = false;
    result->core_control_ok = false;
    result->ready = false;
    result->address = 0U;
    result->device_count = 0U;
    result->core_before = 0U;
    result->core_after = 0U;
    result->dac_before = 0U;
    result->dac_after = 0U;
}

dsplink_boot_result_t dsplink_boot_tsa1701(void)
{
    uint16_t core_after = 0U;
    uint16_t dac_after = 0U;
    const dsplink_bus_scan_t scan = dsplink_bus_i2c1_scan();
    dsplink_boot_result_t result;

    dsplink_boot_result_clear(&result);
    result.found = scan.found_adau1701;
    result.readback_ok = scan.control_read_ok;
    result.address = scan.adau1701_address;
    result.device_count = scan.device_count;
    result.core_before = scan.dsp_core_control;
    result.core_after = scan.dsp_core_control;
    result.dac_before = scan.dac_setup;
    result.dac_after = scan.dac_setup;

    if (!scan.found_adau1701 || !scan.control_read_ok) {
        return result;
    }

    result.firmware_loaded = load_adau1701_selfboot_image(scan.adau1701_address);
    if (!result.firmware_loaded) {
        return result;
    }

    {
        const uint16_t target_dac_setup =
                (uint16_t)((scan.dac_setup & 0xFFFCU)
                           | DSPLINK_ADAU1701_DAC_SETUP_DS_48KHZ);
        const dsplink_bus_status_t write_status =
                dsplink_bus_adau1701_write_u16(
                    scan.adau1701_address,
                    DSPLINK_ADAU1701_DAC_SETUP_REGISTER,
                    target_dac_setup);
        const dsplink_bus_status_t verify_status =
                dsplink_bus_adau1701_read_u16(
                    scan.adau1701_address,
                    DSPLINK_ADAU1701_DAC_SETUP_REGISTER,
                    &dac_after);

        result.dac_after = dac_after;
        result.dac_config_ok =
                (write_status == DSPLINK_BUS_OK)
                && (verify_status == DSPLINK_BUS_OK)
                && (dac_after == target_dac_setup);
    }

    {
        const uint16_t ready_mask =
                (uint16_t)(DSPLINK_ADAU1701_CORE_ANALOG_PASS_MASK
                           | DSPLINK_ADAU1701_CORE_AUX_ADC_CONTROL_PORT);
        const uint16_t target_core =
                (uint16_t)(scan.dsp_core_control
                           | ready_mask);
        const dsplink_bus_status_t write_status =
                dsplink_bus_adau1701_write_u16(
                    scan.adau1701_address,
                    DSPLINK_ADAU1701_CORE_CONTROL_REGISTER,
                    target_core);
        const dsplink_bus_status_t verify_status =
                dsplink_bus_adau1701_read_u16(
                    scan.adau1701_address,
                    DSPLINK_ADAU1701_CORE_CONTROL_REGISTER,
                    &core_after);

        result.core_after = core_after;
        result.core_control_ok =
                (write_status == DSPLINK_BUS_OK)
                && (verify_status == DSPLINK_BUS_OK)
                && ((core_after & ready_mask) == ready_mask);
    }

    result.ready = result.firmware_loaded
                   && result.dac_config_ok
                   && result.core_control_ok;
    return result;
}
