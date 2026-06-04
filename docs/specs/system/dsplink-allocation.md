# DSPLink Proof-of-Concept Allocation

## 1. Purpose

This document records how the DSPLink proof-of-concept material is allocated to
the correct AudioLab repository boundaries.

DSPLink is useful evidence for STM32F429ZI firmware structure, state-machine
design, I2C bring-up, UART diagnostics, UI state handling, PlatformIO setup, and
test organization. It is not the finished AudioLab implementation because it
targets an ADAU1701/TSA1701 DSP board plus a Multifunction Shield, while
AudioLab's implemented hardware is a TLV320AIC3104 codec daughterboard.

## 2. Target Contract Difference

| Boundary | DSPLink proof of concept | AudioLab finished target |
| --- | --- | --- |
| Controller | NUCLEO-F429ZI | NUCLEO-F429ZI |
| Audio target | TSA1701 / ADAU1701 DSP board | TLV320AIC3104 codec daughterboard |
| Real-time processing location | External ADAU1701 SigmaDSP | STM32F429ZI firmware DSP path |
| Audio sample path | Analog audio through external DSP board | USB audio, SAI/I2S, codec ADC/DAC |
| Control bus | I2C/SPI-style DSP register and memory writes | I2C codec register control |
| Local UI | Multifunction Shield buttons, LEDs, display, pot | Optional diagnostics/control only, not part of current hardware contract |
| Host UI | Static browser preset tuner | Optional future host UI after CLI/control protocol |

The AudioLab documentation and source tree shall not present ADAU1701 register
maps, SigmaDSP safeload addresses, TSA1701 presets, or Multifunction Shield pin
assignments as AudioLab hardware or firmware contracts.

## 3. Allocation Summary

| DSPLink content | AudioLab allocation | Action |
| --- | --- | --- |
| `platformio.ini` | `firmware/stm32/platformio.ini` | Allocated as the STM32Cube/NUCLEO-F429ZI PlatformIO build seed. |
| `README.md` | `firmware/stm32/README.md` | Allocated as the proof-of-concept firmware README. It still documents DSPLink and must be revised during TLV320AIC3104 cleanup. |
| `include/` | `firmware/stm32/include/` | Allocated as PlatformIO firmware headers. |
| `src/` | `firmware/stm32/src/` | Allocated as PlatformIO firmware source. |
| `lib/` | `firmware/stm32/lib/` | Allocated as PlatformIO private-library area. |
| `test/` | `firmware/stm32/test/` | Allocated as PlatformIO firmware tests. |
| `frontend/` | `software/host/ui-prototypes/dsplink-preset-tuner/` | Allocated as a static UI prototype only. It should not become the primary host implementation before CLI and protocol are stable. |
| `docs/ADAU1701.pdf` | `docs/reference/dsplink/ADAU1701.pdf` | Allocated as proof-of-concept reference material, not as an AudioLab TLV320AIC3104 dependency. |
| `.pio/`, build outputs, `.vscode/` | Not allocated | Generated or local IDE material. These were intentionally left out of the repository source layout. |

## 4. Firmware Migration Rules

The allocated firmware proof of concept should preserve these DSPLink
qualities:

- one explicit system state model;
- named status and fault codes;
- no hidden bus failures;
- visible boot diagnostics;
- pure, host-testable state and parameter logic;
- separation between hardware adapters and application decisions.

The final AudioLab firmware cleanup must replace these DSPLink-specific
assumptions:

- ADAU1701 address scanning and register map;
- SigmaDSP program, parameter RAM, and safeload writes;
- TSA1701 boot verification;
- external DSP-owned audio processing;
- Multifunction Shield as required UI hardware;
- preset meanings based on SigmaDSP mixer paths.

The AudioLab firmware shall instead implement:

- TLV320AIC3104 reset and I2C register driver;
- STM32-generated SAI/I2S clocks and DMA audio transport;
- USB Audio device behavior;
- STM32-owned real-time DSP block or bypass path;
- safe codec mute/unmute transitions;
- diagnostics for codec, USB, SAI/I2S, DMA, buffer, and DSP state.

## 5. Host Software Migration Rules

The static DSPLink browser tuner now lives under
`software/host/ui-prototypes/dsplink-preset-tuner/`. It can inform a future
AudioLab UI, especially its clear preset editing and payload preview, but it
shall not replace the planned host CLI and protocol library.

Host software should first implement the contract in
`docs/specs/software/architecture.md`:

```text
CLI/library -> application workflows -> domain protocol -> USB control transport
```

A later browser or GUI surface may live as an interface adapter after the
firmware control protocol is stable. Any UI payload preview must show AudioLab
codec/DSP commands, not SigmaDSP safeload data.

## 6. Documentation Allocation

DSPLink concepts are already reflected in the AudioLab specs as follows:

- explicit firmware state machine: `docs/specs/firmware/architecture.md`;
- I2C control discipline and error reporting: firmware and system specs;
- named presets and parameter validation: firmware and software specs;
- debug and diagnostics expectations: firmware, software, and system specs;
- repository boundary separation: `README.md`.

When target cleanup begins, update the specs from planned language to validated
facts only after the corresponding hardware or firmware behavior has been tested
against AudioLab hardware.

## 7. Do-Not-Carry Items

The following DSPLink proof-of-concept items should not be migrated into
AudioLab without a deliberate new requirement:

- ADAU1701/TSA1701 component assumptions;
- SigmaStudio-generated firmware blobs;
- 5.23 SigmaDSP coefficient addresses;
- MFS-specific display strings as product states;
- raw register-write workflows as normal user commands;
- generated PlatformIO `.pio/` artifacts;
- IDE-local `.vscode/` settings.
