// Action Types
const UPLOAD_IMAGE_PENDING = 'image/upload/pending';
const UPLOAD_IMAGE_FULFILLED = 'image/upload/fulfilled';
const UPLOAD_IMAGE_REJECTED = 'image/upload/rejected';
const DELETE_IMAGE_PENDING = 'image/delete/pending';
const DELETE_IMAGE_FULFILLED = 'image/delete/fulfilled';
const DELETE_IMAGE_REJECTED = 'image/delete/rejected';

const initialState = {
    images: [],
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
};

// Action Creators
export const uploadImage = (file) => async (dispatch) => {
    dispatch({ type: UPLOAD_IMAGE_PENDING });
    try {
        // This will be replaced with a call to the image upload service
        const imageUrl = `/uploads/${file.name}`;
        dispatch({ type: UPLOAD_IMAGE_FULFILLED, payload: { url: imageUrl, filename: file.name } });
    } catch (error) {
        dispatch({ type: UPLOAD_IMAGE_REJECTED, payload: error.message });
    }
};

export const deleteImage = (imageName) => async (dispatch) => {
    dispatch({ type: DELETE_IMAGE_PENDING });
    try {
        // This will be replaced with a call to the image delete service
        dispatch({ type: DELETE_IMAGE_FULFILLED, payload: imageName });
    } catch (error) {
        dispatch({ type: DELETE_IMAGE_REJECTED, payload: error.message });
    }
};

// Reducer
export const imageReducer = (state = initialState, action) => {
    switch (action.type) {
        case UPLOAD_IMAGE_PENDING:
        case DELETE_IMAGE_PENDING:
            return {
                ...state,
                status: 'loading',
            };
        case UPLOAD_IMAGE_FULFILLED:
            return {
                ...state,
                status: 'succeeded',
                images: [...state.images, action.payload],
            };
        case UPLOAD_IMAGE_REJECTED:
        case DELETE_IMAGE_REJECTED:
            return {
                ...state,
                status: 'failed',
                error: action.payload,
            };
        case DELETE_IMAGE_FULFILLED:
            return {
                ...state,
                status: 'succeeded',
                images: state.images.filter((image) => image.filename !== action.payload),
            };
        default:
            return state;
    }
};
