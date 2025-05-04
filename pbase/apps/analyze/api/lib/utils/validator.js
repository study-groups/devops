import Joi from 'joi';

export const analyzeSchema = Joi.object({
    InputURL: Joi.string().uri().required()
});

const Validator = {
    validateAnalyzeRequest(data) {
        return analyzeSchema.validate(data);
    }
};

export default Validator; 