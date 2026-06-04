#include "dsplink_presets.h"

#include <stdbool.h>

#include "dsplink_state.h"

const char *dsplink_preset_description(dsplink_preset_t preset)
{
    switch (preset) {
    case DSPLINK_PRESET_FLAT:
        return "TinySine flat gain/EQ control";
    case DSPLINK_PRESET_BASS:
        return "TinySine mixer path 1 only";
    case DSPLINK_PRESET_VOICE:
        return "TinySine mixer path 2 only";
    case DSPLINK_PRESET_NIGHT:
        return "TinySine reduced all-path gain";
    case DSPLINK_PRESET_FILTER:
        return "TinySine mixer path 3 only";
    case DSPLINK_PRESET_COUNT:
    default:
        return "unknown preset";
    }
}

bool dsplink_preset_has_exported_audio_data(dsplink_preset_t preset)
{
    return preset < DSPLINK_PRESET_COUNT;
}
