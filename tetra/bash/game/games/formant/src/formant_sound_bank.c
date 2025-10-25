/**
 * formant_sound_bank.c
 *
 * Sound bank management with phoneme BST and grain analysis
 * Organizes pre-recorded formant samples by phonetic feature hierarchy
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdint.h>
#include "formant.h"

/* ============================================================================
 * Phonetic Feature Encoding
 * ========================================================================= */

/**
 * Calculate feature vector for BST ordering
 *
 * Bit layout (8 bits):
 * [7] Vowel(0) / Consonant(1)
 * [6] Unvoiced(0) / Voiced(1)
 * [5] Sonorant(0) / Obstruent(1)
 * [4-3] Place: labial(00), alveolar(01), velar(10), glottal(11)
 * [2-1] Manner: stop(00), fricative(01), nasal(10), approximant(11)
 * [0] Reserved
 *
 * For vowels, bits [5-0] encode height/backness/rounding
 */
uint8_t sound_bank_calc_feature_vector(const formant_phoneme_config_t* phoneme) {
    if (!phoneme) {
        return 0;
    }

    uint8_t features = 0;

    switch (phoneme->type) {
        case FORMANT_PHONEME_VOWEL:
            /* Vowel: bit 7 = 0 */
            features |= 0x00;

            /* Encode vowel features in bits [5-0] */
            /* Simple encoding based on F1/F2 (height/backness) */
            if (phoneme->f1 < 400.0f) {
                features |= 0x20;  /* High vowel */
            } else if (phoneme->f1 > 700.0f) {
                features |= 0x00;  /* Low vowel */
            } else {
                features |= 0x10;  /* Mid vowel */
            }

            if (phoneme->f2 > 1800.0f) {
                features |= 0x08;  /* Front vowel */
            } else {
                features |= 0x00;  /* Back vowel */
            }

            features |= (phoneme->voiced ? 0x40 : 0x00);
            break;

        case FORMANT_PHONEME_PLOSIVE:
            /* Consonant: bit 7 = 1 */
            features |= 0x80;
            features |= (phoneme->voiced ? 0x40 : 0x00);
            features |= 0x20;  /* Obstruent */
            /* Stop manner */
            features |= 0x00;
            /* Place encoded in bits [4-3] based on phoneme */
            if (strstr(phoneme->ipa, "p") || strstr(phoneme->ipa, "b")) {
                features |= 0x00;  /* Labial */
            } else if (strstr(phoneme->ipa, "t") || strstr(phoneme->ipa, "d")) {
                features |= 0x08;  /* Alveolar */
            } else if (strstr(phoneme->ipa, "k") || strstr(phoneme->ipa, "g")) {
                features |= 0x10;  /* Velar */
            }
            break;

        case FORMANT_PHONEME_FRICATIVE:
            features |= 0x80;  /* Consonant */
            features |= (phoneme->voiced ? 0x40 : 0x00);
            features |= 0x20;  /* Obstruent */
            features |= 0x02;  /* Fricative manner */
            /* Place based on IPA */
            if (strstr(phoneme->ipa, "f") || strstr(phoneme->ipa, "v")) {
                features |= 0x00;  /* Labial */
            } else if (strstr(phoneme->ipa, "s") || strstr(phoneme->ipa, "z")) {
                features |= 0x08;  /* Alveolar */
            } else if (strstr(phoneme->ipa, "h")) {
                features |= 0x18;  /* Glottal */
            }
            break;

        case FORMANT_PHONEME_NASAL:
            features |= 0x80;  /* Consonant */
            features |= 0x40;  /* Voiced (nasals are always voiced) */
            features |= 0x00;  /* Sonorant */
            features |= 0x04;  /* Nasal manner */
            /* Place */
            if (strstr(phoneme->ipa, "m")) {
                features |= 0x00;  /* Labial */
            } else if (strstr(phoneme->ipa, "n")) {
                features |= 0x08;  /* Alveolar */
            }
            break;

        case FORMANT_PHONEME_APPROXIMANT:
        case FORMANT_PHONEME_LATERAL:
        case FORMANT_PHONEME_RHOTIC:
            features |= 0x80;  /* Consonant */
            features |= 0x40;  /* Voiced */
            features |= 0x00;  /* Sonorant */
            features |= 0x06;  /* Approximant manner */
            break;

        case FORMANT_PHONEME_SILENCE:
            features = 0xFF;  /* Special marker */
            break;
    }

    return features;
}

/* ============================================================================
 * BST Operations
 * ========================================================================= */

static phoneme_bst_node_t* bst_create_node(const formant_phoneme_config_t* phoneme, sound_grain_t* grain) {
    phoneme_bst_node_t* node = (phoneme_bst_node_t*)calloc(1, sizeof(phoneme_bst_node_t));
    if (!node) {
        return NULL;
    }

    node->phoneme = phoneme;
    node->grain = grain;
    node->left = NULL;
    node->right = NULL;
    node->feature_vector = sound_bank_calc_feature_vector(phoneme);

    return node;
}

static void bst_insert_node(phoneme_bst_node_t** root, phoneme_bst_node_t* new_node) {
    if (!new_node) {
        return;
    }

    if (*root == NULL) {
        *root = new_node;
        return;
    }

    /* Compare feature vectors */
    if (new_node->feature_vector < (*root)->feature_vector) {
        bst_insert_node(&(*root)->left, new_node);
    } else {
        bst_insert_node(&(*root)->right, new_node);
    }
}

static phoneme_bst_node_t* bst_find_node(phoneme_bst_node_t* root, const char* phoneme) {
    if (!root || !phoneme) {
        return NULL;
    }

    /* Check if this node matches */
    if (root->phoneme && strcmp(root->phoneme->ipa, phoneme) == 0) {
        return root;
    }

    /* Search left subtree */
    phoneme_bst_node_t* found = bst_find_node(root->left, phoneme);
    if (found) {
        return found;
    }

    /* Search right subtree */
    return bst_find_node(root->right, phoneme);
}

static void bst_destroy_tree(phoneme_bst_node_t* node) {
    if (!node) {
        return;
    }

    bst_destroy_tree(node->left);
    bst_destroy_tree(node->right);
    free(node);
}

/* ============================================================================
 * Grain Analysis
 * ========================================================================= */

/**
 * Find best loop points using autocorrelation
 * Simple implementation - finds pitch period and suggests loop points
 */
static int find_loop_points(const float* audio, int length, int sample_rate,
                            uint32_t* loop_start, uint32_t* loop_end) {
    if (!audio || length < 1024) {
        return -1;
    }

    /* Estimate pitch period using autocorrelation on middle section */
    int search_start = length / 3;
    int search_len = length / 3;
    int min_period = sample_rate / 500;  /* Min 500Hz */
    int max_period = sample_rate / 80;   /* Max 80Hz */

    float max_corr = 0.0f;
    int best_lag = min_period;

    for (int lag = min_period; lag < max_period && lag < search_len / 2; lag++) {
        float corr = 0.0f;
        int count = 0;

        for (int i = search_start; i < search_start + search_len - lag; i++) {
            corr += audio[i] * audio[i + lag];
            count++;
        }

        if (count > 0) {
            corr /= count;
            if (corr > max_corr) {
                max_corr = corr;
                best_lag = lag;
            }
        }
    }

    /* Set loop points based on pitch period */
    int midpoint = length / 2;
    *loop_start = midpoint - best_lag;
    *loop_end = midpoint + best_lag;

    /* Ensure within bounds */
    if (*loop_start < 0) *loop_start = 0;
    if (*loop_end >= (uint32_t)length) *loop_end = length - 1;

    return 0;
}

/**
 * Calculate gain map by dividing audio into chunks and measuring RMS
 */
static int calculate_gain_map(const float* audio, int length, int num_chunks,
                              float** gain_map_out) {
    if (!audio || length < num_chunks || !gain_map_out) {
        return -1;
    }

    float* gain_map = (float*)calloc(num_chunks, sizeof(float));
    if (!gain_map) {
        return -1;
    }

    int chunk_size = length / num_chunks;

    for (int c = 0; c < num_chunks; c++) {
        int start = c * chunk_size;
        int end = (c == num_chunks - 1) ? length : start + chunk_size;

        /* Calculate RMS for this chunk */
        float sum = 0.0f;
        int count = 0;

        for (int i = start; i < end; i++) {
            sum += audio[i] * audio[i];
            count++;
        }

        if (count > 0) {
            gain_map[c] = sqrtf(sum / count);
        } else {
            gain_map[c] = 0.0f;
        }
    }

    *gain_map_out = gain_map;
    return num_chunks;
}

/**
 * Simple WAV file reader (mono, 16-bit PCM)
 */
static int load_wav_file(const char* filename, float** audio_out, int* length_out, float* sample_rate_out) {
    FILE* fp = fopen(filename, "rb");
    if (!fp) {
        fprintf(stderr, "ERROR: Failed to open WAV file: %s\n", filename);
        return -1;
    }

    /* Read WAV header (simplified - assumes standard format) */
    uint8_t header[44];
    if (fread(header, 1, 44, fp) != 44) {
        fprintf(stderr, "ERROR: Invalid WAV header\n");
        fclose(fp);
        return -1;
    }

    /* Extract sample rate (bytes 24-27) */
    uint32_t sample_rate = *(uint32_t*)&header[24];
    *sample_rate_out = (float)sample_rate;

    /* Extract data size (bytes 40-43) */
    uint32_t data_size = *(uint32_t*)&header[40];
    int num_samples = data_size / 2;  /* 16-bit = 2 bytes per sample */

    /* Allocate audio buffer */
    float* audio = (float*)malloc(num_samples * sizeof(float));
    if (!audio) {
        fprintf(stderr, "ERROR: Failed to allocate audio buffer\n");
        fclose(fp);
        return -1;
    }

    /* Read and convert 16-bit PCM to float */
    int16_t* pcm_buffer = (int16_t*)malloc(num_samples * sizeof(int16_t));
    if (!pcm_buffer) {
        free(audio);
        fclose(fp);
        return -1;
    }

    if (fread(pcm_buffer, sizeof(int16_t), num_samples, fp) != (size_t)num_samples) {
        fprintf(stderr, "ERROR: Failed to read audio data\n");
        free(audio);
        free(pcm_buffer);
        fclose(fp);
        return -1;
    }

    /* Convert to float (-1.0 to 1.0) */
    for (int i = 0; i < num_samples; i++) {
        audio[i] = pcm_buffer[i] / 32768.0f;
    }

    free(pcm_buffer);
    fclose(fp);

    *audio_out = audio;
    *length_out = num_samples;

    return 0;
}

/* ============================================================================
 * Public API
 * ========================================================================= */

sound_bank_t* sound_bank_create(const char* bank_path) {
    sound_bank_t* bank = (sound_bank_t*)calloc(1, sizeof(sound_bank_t));
    if (!bank) {
        return NULL;
    }

    bank->root = NULL;
    bank->grains = NULL;
    bank->num_grains = 0;
    bank->capacity = 0;

    if (bank_path) {
        strncpy(bank->bank_path, bank_path, sizeof(bank->bank_path) - 1);
    }

    fprintf(stderr, "Created sound bank: %s\n", bank_path ? bank_path : "(empty)");
    return bank;
}

void sound_bank_destroy(sound_bank_t* bank) {
    if (!bank) {
        return;
    }

    /* Destroy BST */
    bst_destroy_tree(bank->root);

    /* Free grains */
    if (bank->grains) {
        for (int i = 0; i < bank->num_grains; i++) {
            free(bank->grains[i].gain_map);
            free(bank->grains[i].audio_data);
        }
        free(bank->grains);
    }

    free(bank);
}

void sound_bank_bst_insert(sound_bank_t* bank, const formant_phoneme_config_t* phoneme, sound_grain_t* grain) {
    if (!bank || !phoneme) {
        return;
    }

    phoneme_bst_node_t* node = bst_create_node(phoneme, grain);
    if (node) {
        bst_insert_node(&bank->root, node);
    }
}

sound_grain_t* sound_bank_find_grain(sound_bank_t* bank, const char* phoneme) {
    if (!bank || !phoneme) {
        return NULL;
    }

    phoneme_bst_node_t* node = bst_find_node(bank->root, phoneme);
    return node ? node->grain : NULL;
}

int sound_bank_analyze_grain(const char* wav_file, sound_grain_t* grain) {
    if (!wav_file || !grain) {
        return -1;
    }

    float* audio = NULL;
    int length = 0;
    float sample_rate = 0;

    /* Load WAV file */
    if (load_wav_file(wav_file, &audio, &length, &sample_rate) != 0) {
        return -1;
    }

    /* Fill in grain metadata */
    strncpy(grain->sample_file, wav_file, sizeof(grain->sample_file) - 1);
    grain->audio_data = audio;
    grain->audio_length = length;
    grain->sample_rate = sample_rate;
    grain->midpoint_sample = length / 2;

    /* Find loop points */
    find_loop_points(audio, length, (int)sample_rate,
                    &grain->loop_start, &grain->loop_end);

    /* Calculate grain duration (loop region) */
    grain->duration_samples = grain->loop_end - grain->loop_start;

    /* Generate gain map (16 chunks) */
    float* gain_map = NULL;
    int num_chunks = calculate_gain_map(audio, length, 16, &gain_map);
    if (num_chunks > 0) {
        grain->gain_map = gain_map;
        grain->gain_map_chunks = num_chunks;
    } else {
        grain->gain_map = NULL;
        grain->gain_map_chunks = 0;
    }

    /* Calculate selection gain (normalize to peak) */
    float peak = 0.0f;
    for (int i = 0; i < length; i++) {
        float abs_val = fabsf(audio[i]);
        if (abs_val > peak) {
            peak = abs_val;
        }
    }

    if (peak > 0.0f) {
        grain->selection_gain = -20.0f * log10f(peak);  /* Gain to normalize to 0dBFS */
    } else {
        grain->selection_gain = 0.0f;
    }

    fprintf(stderr, "Analyzed grain: %s\n", wav_file);
    fprintf(stderr, "  Length: %d samples (%.2fs)\n", length, length / sample_rate);
    fprintf(stderr, "  Loop: %u - %u (%u samples)\n", grain->loop_start, grain->loop_end, grain->duration_samples);
    fprintf(stderr, "  Peak: %.2f (gain: %.1fdB)\n", peak, grain->selection_gain);
    fprintf(stderr, "  Gain map: %d chunks\n", grain->gain_map_chunks);

    return 0;
}

int sound_bank_export_grain_metadata(const sound_grain_t* grain, const char* filename) {
    if (!grain || !filename) {
        return -1;
    }

    FILE* fp = fopen(filename, "w");
    if (!fp) {
        fprintf(stderr, "ERROR: Failed to create metadata file: %s\n", filename);
        return -1;
    }

    /* Write JSON metadata */
    fprintf(fp, "{\n");
    fprintf(fp, "  \"phoneme\": \"%s\",\n", grain->phoneme);
    fprintf(fp, "  \"sample_file\": \"%s\",\n", grain->sample_file);
    fprintf(fp, "  \"sample_rate\": %.0f,\n", grain->sample_rate);
    fprintf(fp, "  \"midpoint_sample\": %u,\n", grain->midpoint_sample);
    fprintf(fp, "  \"duration_samples\": %u,\n", grain->duration_samples);
    fprintf(fp, "  \"loop_start\": %u,\n", grain->loop_start);
    fprintf(fp, "  \"loop_end\": %u,\n", grain->loop_end);
    fprintf(fp, "  \"selection_gain_db\": %.2f,\n", grain->selection_gain);
    fprintf(fp, "  \"gain_map\": [");

    if (grain->gain_map && grain->gain_map_chunks > 0) {
        for (int i = 0; i < grain->gain_map_chunks; i++) {
            fprintf(fp, "%.4f%s", grain->gain_map[i],
                   (i < grain->gain_map_chunks - 1) ? ", " : "");
        }
    }

    fprintf(fp, "]\n");
    fprintf(fp, "}\n");

    fclose(fp);

    fprintf(stderr, "Exported grain metadata: %s\n", filename);
    return 0;
}

void sound_bank_print_tree(phoneme_bst_node_t* node, int depth) {
    if (!node) {
        return;
    }

    /* Print right subtree (higher features) */
    sound_bank_print_tree(node->right, depth + 1);

    /* Print this node */
    for (int i = 0; i < depth; i++) {
        fprintf(stderr, "    ");
    }
    fprintf(stderr, "[%02X] %s\n", node->feature_vector,
           node->phoneme ? node->phoneme->ipa : "?");

    /* Print left subtree (lower features) */
    sound_bank_print_tree(node->left, depth + 1);
}
