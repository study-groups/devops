#!/usr/bin/env bash
# EstoVox Expression Presets
# Emotional and communicative facial expressions

estovox_get_expression_preset() {
    local expression=$1

    case $expression in
        # Neutral face
        neutral)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.5"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.5"
            echo "ESTOVOX_EYEBROW_L_ARCH:0.5"
            echo "ESTOVOX_EYEBROW_R_ARCH:0.5"
            echo "ESTOVOX_EYE_OPENNESS:1.0"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.5"
            ;;

        # Happy/smile
        happy|smile)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.6"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.6"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.9"
            echo "ESTOVOX_EYE_OPENNESS:0.7"
            ;;

        # Sad
        sad)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.4"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.4"
            echo "ESTOVOX_EYEBROW_L_ANGLE:0.3"
            echo "ESTOVOX_EYEBROW_R_ANGLE:0.7"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.2"
            echo "ESTOVOX_EYE_OPENNESS:0.6"
            ;;

        # Angry
        angry)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.2"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.2"
            echo "ESTOVOX_EYEBROW_L_ARCH:0.8"
            echo "ESTOVOX_EYEBROW_R_ARCH:0.8"
            echo "ESTOVOX_LIP_COMPRESSION:0.4"
            echo "ESTOVOX_EYE_OPENNESS:0.8"
            ;;

        # Surprised
        surprised)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:1.0"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:1.0"
            echo "ESTOVOX_EYE_OPENNESS:1.0"
            echo "ESTOVOX_JAW_OPENNESS:0.5"
            ;;

        # Eyebrow variations
        eyebrow_raised|raised)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.9"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.9"
            echo "ESTOVOX_EYEBROW_L_ARCH:0.6"
            echo "ESTOVOX_EYEBROW_R_ARCH:0.6"
            ;;

        eyebrow_furrowed|furrowed)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.3"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.3"
            echo "ESTOVOX_EYEBROW_L_ARCH:0.7"
            echo "ESTOVOX_EYEBROW_R_ARCH:0.7"
            echo "ESTOVOX_EYEBROW_L_ANGLE:0.3"
            echo "ESTOVOX_EYEBROW_R_ANGLE:0.7"
            ;;

        eyebrow_skeptical|skeptical)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.8"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.4"
            echo "ESTOVOX_EYEBROW_SYMMETRY:0.0"
            ;;

        # Fear
        fear|scared)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.9"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.9"
            echo "ESTOVOX_EYEBROW_L_ARCH:0.7"
            echo "ESTOVOX_EYEBROW_R_ARCH:0.7"
            echo "ESTOVOX_EYE_OPENNESS:1.0"
            echo "ESTOVOX_JAW_OPENNESS:0.3"
            ;;

        # Disgust
        disgust)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.3"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.3"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.3"
            echo "ESTOVOX_JAW_OPENNESS:0.2"
            ;;

        # Thinking/contemplating
        thinking)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.6"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.5"
            echo "ESTOVOX_GAZE_H:0.3"
            echo "ESTOVOX_GAZE_V:0.3"
            ;;

        # Wink
        wink_left)
            echo "ESTOVOX_EYE_L_OPENNESS:0.0"
            echo "ESTOVOX_EYE_R_OPENNESS:1.0"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.6"
            ;;

        wink_right)
            echo "ESTOVOX_EYE_L_OPENNESS:1.0"
            echo "ESTOVOX_EYE_R_OPENNESS:0.0"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.6"
            ;;

        # Blink
        blink)
            echo "ESTOVOX_EYE_OPENNESS:0.0"
            ;;

        # Speaking/animated
        animated)
            echo "ESTOVOX_EYEBROW_L_HEIGHT:0.6"
            echo "ESTOVOX_EYEBROW_R_HEIGHT:0.6"
            echo "ESTOVOX_EYE_OPENNESS:0.9"
            echo "ESTOVOX_LIP_CORNER_HEIGHT:0.6"
            ;;

        *)
            return 1
            ;;
    esac
}

estovox_list_expressions() {
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
