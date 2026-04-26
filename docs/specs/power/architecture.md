# AudioLab Power Distribution Architecture

## 1. Purpose

This document defines the intended power distribution architecture for AudioLab.
It identifies external power sources, internal voltage rails, regulator roles,
power sequencing, measurement points, protection requirements, and open
electrical decisions.

This is an architecture specification, not a final schematic. Exact regulator
part numbers, capacitor values, ferrite beads, protection devices, and layout
details belong in the hardware architecture and schematic design.

## 2. Design Goals

The power system shall:

- provide stable codec analog, digital-core, and digital-I/O supplies;
- keep STM32 and codec digital I/O levels compatible;
- avoid back-feeding USB, the NUCLEO-F429ZI board, or codec daughterboard rails;
- separate noisy digital power from sensitive analog audio power where practical;
- expose rails for measurement and bring-up;
- support safe startup, reset, and audio-output muting;
- remain simple enough for a laboratory final-project implementation.

## 3. Vendor Constraints

The TLV320AIC3104 supply domains constrain the codec rail choices:

| Domain | Intended rail | Constraint basis |
| --- | ---: | --- |
| `AVDD` | `+3V3_A` | Codec analog supply supports 2.7 V to 3.6 V. |
| `DRVDD` | `+3V3_A` | Codec output-driver supply supports the analog supply range. |
| `DVDD` | `+1V8_D` | Codec digital-core supply supports 1.525 V to 1.95 V. |
| `IOVDD` | `+3V3_IO` | Codec digital-I/O supply supports 1.1 V to 3.6 V. |

The STM32F429ZI target uses 3.3 V I/O, so `IOVDD` shall be `+3V3_IO` unless a
future hardware revision adds explicit level shifting.

The NUCLEO-F429ZI user USB connector `CN13` shall not be treated as a board power
input. It is for the target STM32 USB OTG FS/device interface. The Nucleo board
must already be powered before connecting USB on `CN13`, because powering through
that connector can inject current into STM32 I/O.

## 4. Power Architecture Summary

The default architecture uses a protected 5 V input for codec daughterboard
power, then derives local low-noise codec rails.

```text
External or Nucleo-compatible 5 V input
  |
  +-- input protection and filtering
      |
      +-- +5V_SYS
          |
          +-- low-noise 3.3 V analog regulator
          |     |
          |     +-- +3V3_A
          |           |
          |           +-- TLV320AIC3104 AVDD
          |           +-- TLV320AIC3104 DRVDD
          |           +-- analog input/output bias and filtering networks
          |
          +-- 1.8 V digital-core regulator
          |     |
          |     +-- +1V8_D
          |           |
          |           +-- TLV320AIC3104 DVDD
          |
          +-- 3.3 V digital-I/O rail
                |
                +-- +3V3_IO
                      |
                      +-- TLV320AIC3104 IOVDD
                      +-- pull-ups for I2C when populated on daughterboard
                      +-- digital control interface references
```

The NUCLEO-F429ZI board remains responsible for its own STM32 power during the
development configuration. The codec daughterboard and Nucleo board shall share a
ground reference at the board-to-board connector.

## 5. Supported Power Modes

### 5.1 Development Mode

Development mode uses two USB connections:

```text
PC USB -> Nucleo CN1
  power, programming, debug, and ST-LINK virtual COM support

PC USB -> Nucleo CN13
  target STM32 USB audio/control data only
```

The codec daughterboard shall be powered from either:

- a protected external 5 V lab supply; or
- a Nucleo/shield 5 V header only after the available current budget is verified.

Development mode is the preferred bring-up mode because it avoids treating `CN13`
as a power source and keeps firmware/debug power separate from target USB data.

### 5.2 Integrated Demonstration Mode

Integrated demonstration mode may use one external 5 V source to power the codec
daughterboard and, if explicitly designed, the Nucleo board through a valid Nucleo
power input path.

This mode requires schematic-level protection against:

- USB back-feed;
- reverse current into regulators;
- accidental connection of multiple 5 V sources;
- excessive current draw from a PC USB port;
- uncontrolled codec power-up while STM32 control pins are unpowered.

Integrated demonstration mode shall not be claimed until back-feed behavior and
startup behavior are validated.

## 6. Rail Definitions

| Rail | Nominal voltage | Source | Loads | Notes |
| --- | ---: | --- | --- | --- |
| `+5V_SYS` | 5.0 V | protected external or approved Nucleo 5 V input | downstream regulators | Main daughterboard input rail. |
| `+3V3_A` | 3.3 V | low-noise analog LDO from `+5V_SYS` | codec `AVDD`, codec `DRVDD`, analog networks | Keep analog return currents controlled. |
| `+1V8_D` | 1.8 V | digital-core LDO from `+5V_SYS` or `+3V3_IO` | codec `DVDD` | Must remain within codec digital-core limits. |
| `+3V3_IO` | 3.3 V | Nucleo 3.3 V or local 3.3 V digital regulator | codec `IOVDD`, I2C pull-ups, digital references | Must match STM32 I/O level. |
| `AGND` | 0 V | board ground system | analog codec and audio returns | Route to avoid noisy digital return sharing near analog inputs. |
| `DGND` | 0 V | board ground system | digital codec and connector returns | Tie to `AGND` using the selected PCB grounding strategy. |

`+3V3_IO` ownership must be chosen before schematic release:

- Option A: use the Nucleo 3.3 V rail as the I/O reference;
- Option B: generate `+3V3_IO` locally from `+5V_SYS`.

Option A reduces parts and guarantees I/O-level tracking with STM32. Option B
keeps the codec daughterboard more self-contained. Either option must prevent
the daughterboard from powering an unpowered STM32 through digital pins.

## 7. Power Sequencing

The preferred codec startup sequence is:

```text
1. +3V3_IO valid
2. +3V3_A valid
3. +1V8_D valid
4. codec RESET held low until rails are stable
5. firmware releases RESET
6. firmware performs codec register initialization over I2C
7. firmware unmutes enabled audio paths
```

The minimum acceptable implementation may allow rails to rise together if:

- `RESET` is held low during rail ramp-up;
- firmware waits for a conservative stabilization delay;
- codec initialization is retried or reported as failed if I2C access fails;
- audio outputs remain muted until the codec is configured.

## 8. Reset, Mute, and Fault Power Behavior

The codec reset signal shall default to the safe state during STM32 reset,
firmware startup, and power instability.

The audio output path shall remain muted or inactive until:

1. all required rails are valid;
2. the codec reset sequence is complete;
3. I2C initialization succeeds;
4. the firmware audio path is ready.

On fault, firmware shall prefer a safe audio state before attempting recovery.
Faults that shall force a safe state include:

- codec I2C initialization failure;
- repeated codec register access failure;
- audio buffer underrun or overrun when it affects output stability;
- host command that requests an unsupported or invalid routing state;
- detected rail or reset anomaly if hardware telemetry is available.

## 9. Protection Requirements

The daughterboard power input shall include protection appropriate for laboratory
use. The final schematic shall evaluate:

- reverse-polarity protection for external 5 V input;
- over-current protection or current limiting;
- USB or Nucleo back-feed prevention;
- ESD protection on user-accessible connectors;
- local bulk capacitance for regulator input stability;
- local decoupling close to every codec supply pin;
- ferrite beads or RC/LC filtering for sensitive analog branches where justified;
- power-good or enable sequencing if a simple reset-delay approach is insufficient.

No protection element shall be selected only to make the schematic look complete.
Each protection element must have a clear failure mode or noise problem that it
addresses.

## 10. Measurement and Bring-Up Points

The hardware should expose the following measurement points:

| Point | Purpose |
| --- | --- |
| `TP_5V_SYS` | verify board input rail |
| `TP_3V3_A` | verify codec analog/output-driver rail |
| `TP_1V8_D` | verify codec digital-core rail |
| `TP_3V3_IO` | verify codec digital-I/O rail |
| `TP_AGND` | analog measurement reference |
| `TP_DGND` | digital measurement reference |
| `TP_RESET` | verify codec reset timing |
| `TP_MCLK` | verify codec master clock during audio bring-up |
| `TP_BCLK` | verify bit-clock frequency |
| `TP_WCLK` | verify sample-rate clock |
| `TP_SCL` | verify I2C clock activity |
| `TP_SDA` | verify I2C data activity |

The hardware should also provide current-measurement options for:

- `+3V3_A` codec analog/output-driver domain;
- `+1V8_D` codec digital-core domain;
- `+3V3_IO` codec digital-I/O domain;
- total daughterboard input current from `+5V_SYS`.

Current measurement may be implemented with removable jumpers, zero-ohm links,
current-sense resistors, or other schematic-level choices. The method must not
make normal operation fragile.

## 11. Initial Current Budget

The current budget shall be finalized from selected operating modes and measured
hardware behavior. Until then, the schematic shall reserve margin for:

| Rail | Budget status | Design note |
| --- | --- | --- |
| `+5V_SYS` | open | Must cover all local regulators and losses. |
| `+3V3_A` | open | Depends on codec output mode, headphone load, analog routing, and DSP demo. |
| `+1V8_D` | open | Depends on codec digital activity and clocking. |
| `+3V3_IO` | open | Depends on I2C pull-ups, digital bus activity, and whether rail is Nucleo-owned. |

The first PCB revision shall be designed with enough regulator and connector
margin to support worst-case laboratory experiments, not only the lowest-power
demo path.

## 12. Grounding Architecture

The design shall use one common system ground while controlling return-current
paths. The PCB layout shall prevent high-current digital or USB return paths from
sharing sensitive analog input return paths near the codec.

The grounding strategy shall define:

- where `AGND` and `DGND` labels meet physically;
- how codec exposed-pad ground is connected;
- where input and output connector shields or sleeve contacts return;
- how test equipment ground clips can be connected without creating fragile
  measurement assumptions;
- how board-to-board ground pins are distributed across the connector.

The final grounding choice belongs in the hardware architecture and PCB layout
review.

## 13. Validation Plan

Power validation shall be performed in this order:

1. inspect the assembled board for shorts between rails and ground;
2. power the board with current limiting enabled;
3. verify `+5V_SYS` before enabling downstream rails;
4. verify `+3V3_A`, `+1V8_D`, and `+3V3_IO` without codec streaming;
5. verify reset remains asserted until rails are stable;
6. verify STM32 and codec I/O compatibility before connecting active buses;
7. validate I2C communication with the codec;
8. validate clocks and digital audio signals;
9. validate analog output startup and mute behavior;
10. measure rail current during idle, playback, capture, full-duplex, and DSP modes.

The system shall not be considered power-safe until the no-load, idle, and active
streaming rail measurements are recorded.

## 14. Open Decisions

The following decisions must be closed before schematic release:

- exact daughterboard 5 V input connector and allowed source modes;
- whether `+3V3_IO` is sourced from Nucleo or generated locally;
- regulator part numbers and dropout/current/noise requirements;
- whether regulator enables or a reset-only sequence is sufficient;
- current measurement implementation for each rail;
- analog/digital ground tie strategy;
- whether output mute is handled only by codec configuration or also by external
  hardware;
- whether the integrated demonstration mode will support one-cable power/data or
  remain a two-cable laboratory setup.

## 15. References

- Texas Instruments, TLV320AIC3104 product page and datasheet, covering codec
  supply domains, I2C control, digital-audio interface support, and audio
  operating ranges: https://www.ti.com/product/TLV320AIC3104
- STMicroelectronics, UM1974 STM32 Nucleo-144 boards user manual, covering
  Nucleo-144 power input behavior and the `CN13` USB OTG FS/device warning:
  https://www.st.com/resource/en/user_manual/um1974-stm32h743-nucleo144-board-stmicroelectronics.pdf
