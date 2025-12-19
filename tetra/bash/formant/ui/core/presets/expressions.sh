#!/usr/bin/env bash
# Formant Expression Presets
# Emotional and communicative facial expressions

formant_get_expression_preset() {
    local expression=$1

    case $expression in
        # Neutral face
        neutral)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.5"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.5"
            echo "FORMANT_EYEBROW_L_ARCH:0.5"
            echo "FORMANT_EYEBROW_R_ARCH:0.5"
            echo "FORMANT_EYE_OPENNESS:1.0"
            echo "FORMANT_LIP_CORNER_HEIGHT:0.5"
            ;;

        # Happy/smile
        happy|smile)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.6"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.6"
            echo "FORMANT_LIP_CORNER_HEIGHT:0.9"
            echo "FORMANT_EYE_OPENNESS:0.7"
            ;;

        # Sad
        sad)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.4"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.4"
            echo "FORMANT_EYEBROW_L_ANGLE:0.3"
            echo "FORMANT_EYEBROW_R_ANGLE:0.7"
            echo "FORMANT_LIP_CORNER_HEIGHT:0.2"
            echo "FORMANT_EYE_OPENNESS:0.6"
            ;;

        # Angry
        angry)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.2"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.2"
            echo "FORMANT_EYEBROW_L_ARCH:0.8"
            echo "FORMANT_EYEBROW_R_ARCH:0.8"
            echo "FORMANT_LIP_COMPRESSION:0.4"
            echo "FORMANT_EYE_OPENNESS:0.8"
            ;;

        # Surprised
        surprised)
            echo "FORMANT_EYEBROW_L_HEIGHT:1.0"
            echo "FORMANT_EYEBROW_R_HEIGHT:1.0"
            echo "FORMANT_EYE_OPENNESS:1.0"
            echo "FORMANT_JAW_OPENNESS:0.5"
            ;;

        # Eyebrow variations
        eyebrow_raised|raised)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.9"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.9"
            echo "FORMANT_EYEBROW_L_ARCH:0.6"
            echo "FORMANT_EYEBROW_R_ARCH:0.6"
            ;;

        eyebrow_furrowed|furrowed)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.3"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.3"
            echo "FORMANT_EYEBROW_L_ARCH:0.7"
            echo "FORMANT_EYEBROW_R_ARCH:0.7"
            echo "FORMANT_EYEBROW_L_ANGLE:0.3"
            echo "FORMANT_EYEBROW_R_ANGLE:0.7"
            ;;

        eyebrow_skeptical|skeptical)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.8"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.4"
            echo "FORMANT_EYEBROW_SYMMETRY:0.0"
            ;;

        # Fear
        fear|scared)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.9"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.9"
            echo "FORMANT_EYEBROW_L_ARCH:0.7"
            echo "FORMANT_EYEBROW_R_ARCH:0.7"
            echo "FORMANT_EYE_OPENNESS:1.0"
            echo "FORMANT_JAW_OPENNESS:0.3"
            ;;

        # Disgust
        disgust)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.3"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.3"
            echo "FORMANT_LIP_CORNER_HEIGHT:0.3"
            echo "FORMANT_JAW_OPENNESS:0.2"
            ;;

        # Thinking/contemplating
        thinking)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.6"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.5"
            echo "FORMANT_GAZE_H:0.3"
            echo "FORMANT_GAZE_V:0.3"
            ;;

        # Wink
        wink_left)
            echo "FORMANT_EYE_L_OPENNESS:0.0"
            echo "FORMANT_EYE_R_OPENNESS:1.0"
            echo "FORMANT_LIP_CORNER_HEIGHT:0.6"
            ;;

        wink_right)
            echo "FORMANT_EYE_L_OPENNESS:1.0"
            echo "FORMANT_EYE_R_OPENNESS:0.0"
            echo "FORMANT_LIP_CORNER_HEIGHT:0.6"
            ;;

        # Blink
        blink)
            echo "FORMANT_EYE_OPENNESS:0.0"
            ;;

        # Speaking/animated
        animated)
            echo "FORMANT_EYEBROW_L_HEIGHT:0.6"
            echo "FORMANT_EYEBROW_R_HEIGHT:0.6"
            echo "FORMANT_EYE_OPENNESS:0.9"
            echo "FORMANT_LIP_CORNER_HEIGHT:0.6"
            ;;

        *)
            return 1
            ;;
    esac
}

formant_list_expressions() {
    cat <<'EOF'
Basic Emotions:
  neutral          - Neutral face
  happy, smile     - Happy/smiling
  sad              - Sad
  angry            - Angry
  surprised        - Surprised
  fear, scared     - Fearful
  disgust          - Disgusted

Eyebrow Expressions:
  raised           - Raised eyebrows
  furrowed         - Furrowed brow
  skeptical        - One eyebrow raised

Other:
  thinking         - Contemplative
  wink_left        - Left eye wink
  wink_right       - Right eye wink
  blink            - Both eyes closed
  animated         - Energetic/speaking
EOF
}
