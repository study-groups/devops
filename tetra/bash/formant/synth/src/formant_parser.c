/**
 * formant_parser.c
 *
 * Command parser for Estovox Command Language (ECL).
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "formant.h"

formant_command_t* formant_parse_command(const char* line) {
    if (!line) return NULL;

    /* Allocate command structure */
    formant_command_t* cmd = (formant_command_t*)calloc(1, sizeof(formant_command_t));
    if (!cmd) return NULL;

    /* Make a copy for tokenization */
    char buffer[1024];
    strncpy(buffer, line, sizeof(buffer) - 1);
    buffer[sizeof(buffer) - 1] = '\0';

    /* Get first token (command) */
    char* token = strtok(buffer, " \t\n");
    if (!token) {
        free(cmd);
        return NULL;
    }

    /* Parse command type */
    if (strcmp(token, "PH") == 0 || strcmp(token, "ph") == 0) {
        cmd->type = FORMANT_CMD_PHONEME;

        /* Parse: PH <ipa> [duration_ms] [pitch_hz] [intensity] [rate] */
        token = strtok(NULL, " \t\n");
        if (!token) { free(cmd); return NULL; }
        strncpy(cmd->params.phoneme.ipa, token, FORMANT_IPA_MAX_LEN - 1);

        cmd->params.phoneme.duration_ms = 100.0f;  /* Default */
        cmd->params.phoneme.pitch_hz = 120.0f;
        cmd->params.phoneme.intensity = 0.7f;
        cmd->params.phoneme.rate = 0.3f;

        if ((token = strtok(NULL, " \t\n"))) cmd->params.phoneme.duration_ms = atof(token);
        if ((token = strtok(NULL, " \t\n"))) cmd->params.phoneme.pitch_hz = atof(token);
        if ((token = strtok(NULL, " \t\n"))) cmd->params.phoneme.intensity = atof(token);
        if ((token = strtok(NULL, " \t\n"))) cmd->params.phoneme.rate = atof(token);

    } else if (strcmp(token, "FM") == 0) {
        cmd->type = FORMANT_CMD_FORMANT;

        /* Parse: FM <f1> <f2> <f3> [bw1] [bw2] [bw3] [duration_ms] */
        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        cmd->params.formant.f1 = atof(token);

        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        cmd->params.formant.f2 = atof(token);

        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        cmd->params.formant.f3 = atof(token);

        cmd->params.formant.bw1 = 50.0f;   /* Defaults */
        cmd->params.formant.bw2 = 100.0f;
        cmd->params.formant.bw3 = 150.0f;
        cmd->params.formant.duration_ms = 100.0f;

        if ((token = strtok(NULL, " \t\n"))) cmd->params.formant.bw1 = atof(token);
        if ((token = strtok(NULL, " \t\n"))) cmd->params.formant.bw2 = atof(token);
        if ((token = strtok(NULL, " \t\n"))) cmd->params.formant.bw3 = atof(token);
        if ((token = strtok(NULL, " \t\n"))) cmd->params.formant.duration_ms = atof(token);

    } else if (strcmp(token, "PR") == 0) {
        cmd->type = FORMANT_CMD_PROSODY;

        /* Parse: PR <param> <value> */
        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        strncpy(cmd->params.prosody.param, token, FORMANT_PARAM_MAX_LEN - 1);

        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        cmd->params.prosody.value = atof(token);

    } else if (strcmp(token, "EM") == 0) {
        cmd->type = FORMANT_CMD_EMOTION;

        /* Parse: EM <emotion> [intensity] */
        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        strncpy(cmd->params.emotion.emotion, token, FORMANT_EMOTION_MAX_LEN - 1);

        cmd->params.emotion.intensity = 0.7f;  /* Default */
        if ((token = strtok(NULL, " \t\n"))) cmd->params.emotion.intensity = atof(token);

    } else if (strcmp(token, "MODE") == 0) {
        cmd->type = FORMANT_CMD_MODE;

        /* Parse: MODE <mode> [mix] */
        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        strncpy(cmd->params.mode.mode, token, 15);

        cmd->params.mode.mix = 0.5f;  /* Default hybrid mix */
        if ((token = strtok(NULL, " \t\n"))) cmd->params.mode.mix = atof(token);

    } else if (strcmp(token, "RESET") == 0) {
        cmd->type = FORMANT_CMD_RESET;

    } else if (strcmp(token, "STOP") == 0) {
        cmd->type = FORMANT_CMD_STOP;

    } else if (strcmp(token, "SYNC") == 0) {
        cmd->type = FORMANT_CMD_SYNC;

        if ((token = strtok(NULL, " \t\n"))) {
            cmd->params.sync.timestamp_ms = strtoull(token, NULL, 10);
        }

    } else if (strcmp(token, "FLUSH") == 0) {
        cmd->type = FORMANT_CMD_FLUSH;

    } else if (strcmp(token, "PAUSE") == 0) {
        cmd->type = FORMANT_CMD_PAUSE;

    } else if (strcmp(token, "RESUME") == 0) {
        cmd->type = FORMANT_CMD_RESUME;

    } else if (strcmp(token, "RECORD") == 0) {
        cmd->type = FORMANT_CMD_RECORD;

        /* Parse: RECORD <phoneme> <duration_ms> <filename> */
        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        strncpy(cmd->params.record.phoneme, token, FORMANT_IPA_MAX_LEN - 1);

        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        cmd->params.record.duration_ms = atof(token);

        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        strncpy(cmd->params.record.filename, token, sizeof(cmd->params.record.filename) - 1);

        cmd->params.record.use_vad = false;
        cmd->params.record.vad_mode = 1;  /* Default */

    } else if (strcmp(token, "RECORD_VAD") == 0) {
        cmd->type = FORMANT_CMD_RECORD_VAD;

        /* Parse: RECORD_VAD <phoneme> <max_duration_ms> <filename> [vad_mode] */
        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        strncpy(cmd->params.record.phoneme, token, FORMANT_IPA_MAX_LEN - 1);

        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        cmd->params.record.duration_ms = atof(token);

        if (!(token = strtok(NULL, " \t\n"))) { free(cmd); return NULL; }
        strncpy(cmd->params.record.filename, token, sizeof(cmd->params.record.filename) - 1);

        /* Optional VAD mode parameter */
        cmd->params.record.use_vad = true;
        cmd->params.record.vad_mode = 1;  /* Default: balanced */
        if ((token = strtok(NULL, " \t\n"))) {
            int mode = atoi(token);
            if (mode >= 0 && mode <= 2) {
                cmd->params.record.vad_mode = mode;
            }
        }

    } else {
        /* Unknown command */
        free(cmd);
        return NULL;
    }

    cmd->timestamp_us = formant_get_time_us();
    return cmd;
}

void formant_queue_command(formant_engine_t* engine, formant_command_t* cmd) {
    if (!engine || !cmd) return;

    /* Check if queue is full */
    if (engine->cmd_queue_size >= FORMANT_MAX_COMMANDS) {
        fprintf(stderr, "WARNING: Command queue full, dropping command\n");
        return;
    }

    /* Add to queue */
    engine->cmd_queue[engine->cmd_queue_tail] = *cmd;
    engine->cmd_queue_tail = (engine->cmd_queue_tail + 1) % FORMANT_MAX_COMMANDS;
    engine->cmd_queue_size++;
}

void formant_process_commands(formant_engine_t* engine) {
    if (!engine) return;

    /* Process all queued commands */
    while (engine->cmd_queue_size > 0) {
        formant_command_t* cmd = &engine->cmd_queue[engine->cmd_queue_head];

        /* Execute command based on type */
        switch (cmd->type) {
            case FORMANT_CMD_PHONEME: {
                /* Get phoneme configuration */
                const formant_phoneme_config_t* phoneme =
                    formant_get_phoneme(cmd->params.phoneme.ipa);

                if (phoneme) {
                    /* Set formant targets */
                    engine->f1_target = phoneme->f1;
                    engine->f2_target = phoneme->f2;
                    engine->f3_target = phoneme->f3;
                    engine->lerp_rate = cmd->params.phoneme.rate;
                    engine->f0_hz = cmd->params.phoneme.pitch_hz;
                    engine->intensity = cmd->params.phoneme.intensity;
                    engine->current_phoneme = phoneme;

                    /* Select CELP excitation if using CELP or hybrid mode */
                    if (engine->synth_mode != FORMANT_SYNTH_MODE_FORMANT) {
                        formant_celp_select_excitation(
                            &engine->celp_engine,
                            phoneme,
                            cmd->params.phoneme.pitch_hz);
                    }
                }
                break;
            }

            case FORMANT_CMD_FORMANT:
                /* Direct formant control */
                engine->f1_target = cmd->params.formant.f1;
                engine->f2_target = cmd->params.formant.f2;
                engine->f3_target = cmd->params.formant.f3;
                break;

            case FORMANT_CMD_PROSODY: {
                /* Set prosody parameter */
                const char* param = cmd->params.prosody.param;
                float value = cmd->params.prosody.value;

                if (strcmp(param, "PITCH") == 0) {
                    engine->pitch_base = value;
                    engine->f0_hz = value;
                } else if (strcmp(param, "RATE") == 0) {
                    engine->rate_multiplier = value;
                } else if (strcmp(param, "VOLUME") == 0) {
                    engine->volume = value;
                }
                break;
            }

            case FORMANT_CMD_MODE: {
                /* Set synthesis mode */
                const char* mode = cmd->params.mode.mode;

                if (strcmp(mode, "FORMANT") == 0 || strcmp(mode, "formant") == 0) {
                    formant_engine_set_mode(engine, FORMANT_SYNTH_MODE_FORMANT);
                } else if (strcmp(mode, "CELP") == 0 || strcmp(mode, "celp") == 0) {
                    formant_engine_set_mode(engine, FORMANT_SYNTH_MODE_CELP);
                } else if (strcmp(mode, "HYBRID") == 0 || strcmp(mode, "hybrid") == 0) {
                    formant_engine_set_mode(engine, FORMANT_SYNTH_MODE_HYBRID);
                    formant_engine_set_hybrid_mix(engine, cmd->params.mode.mix);
                }
                break;
            }

            case FORMANT_CMD_RESET:
                formant_engine_reset(engine);
                break;

            case FORMANT_CMD_PAUSE:
                engine->paused = true;
                break;

            case FORMANT_CMD_RESUME:
                engine->paused = false;
                break;

            case FORMANT_CMD_RECORD: {
                /* Start fixed-duration recording */
                if (engine->recorder) {
                    if (formant_recorder_is_recording(engine->recorder)) {
                        fprintf(stderr, "WARNING: Already recording, stopping previous recording\n");
                        formant_recorder_stop(engine->recorder);
                    }

                    int result = formant_recorder_start(
                        engine->recorder,
                        cmd->params.record.filename,
                        cmd->params.record.duration_ms
                    );

                    if (result != 0) {
                        fprintf(stderr, "ERROR: Failed to start recording\n");
                    }
                } else {
                    fprintf(stderr, "ERROR: Recorder not initialized\n");
                }
                break;
            }

            case FORMANT_CMD_RECORD_VAD: {
                /* Start VAD-triggered recording */
                if (engine->recorder) {
                    if (formant_recorder_is_recording(engine->recorder)) {
                        fprintf(stderr, "WARNING: Already recording, stopping previous recording\n");
                        formant_recorder_stop(engine->recorder);
                    }

                    int result = formant_recorder_start_vad(
                        engine->recorder,
                        cmd->params.record.filename,
                        cmd->params.record.duration_ms,
                        cmd->params.record.vad_mode
                    );

                    if (result != 0) {
                        fprintf(stderr, "ERROR: Failed to start VAD recording\n");
                    }
                } else {
                    fprintf(stderr, "ERROR: Recorder not initialized\n");
                }
                break;
            }

            default:
                break;
        }

        /* Remove from queue */
        engine->cmd_queue_head = (engine->cmd_queue_head + 1) % FORMANT_MAX_COMMANDS;
        engine->cmd_queue_size--;
    }
}
