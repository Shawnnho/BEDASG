const Joi = require("joi"); 


const createRentalSchema = Joi.object({
  centreId: Joi.string().required().messages({
    "string.empty": "centreId cannot be empty",
    "any.required": "centreId is required",
  }),
  stallId: Joi.string().required().messages({
    "string.empty": "stallId cannot be empty",
    "any.required": "stallId is required",
  }),
  ownerName: Joi.string().min(1).max(100).required().messages({
    "string.empty": "Owner name cannot be empty",
    "string.max": "Owner name cannot exceed 100 characters",
    "any.required": "Owner name is required",
  }),
  monthlyRent: Joi.number().min(0).required().messages({
    "number.base": "Monthly rent must be a number",
    "number.min": "Monthly rent must be 0 or more",
    "any.required": "Monthly rent is required",
  }),
  startDate: Joi.date().required().messages({
    "date.base": "Start date must be a valid date",
    "any.required": "Start date is required",
  }),
  unitNo: Joi.string().allow("", null),
  utilities: Joi.number().min(0).default(0).messages({
    "number.min": "Utilities must be 0 or more",
  }),
  cleaningFee: Joi.number().min(0).default(0).messages({
    "number.min": "Cleaning fee must be 0 or more",
  }),
  penalty: Joi.number().min(0).default(0).messages({
    "number.min": "Penalty must be 0 or more",
  }),
  other: Joi.number().min(0).default(0).messages({
    "number.min": "Other charges must be 0 or more",
  }),
});

const saveBillSchema = Joi.object({
  centreId: Joi.string().required().messages({
    "string.empty": "centreId cannot be empty",
    "any.required": "centreId is required",
  }),
  agreementId: Joi.string().allow("", null),
  rent: Joi.number().min(0).default(0).messages({
    "number.min": "Rent must be 0 or more",
  }),
  utilities: Joi.number().min(0).default(0).messages({
    "number.min": "Utilities must be 0 or more",
  }),
  cleaningFee: Joi.number().min(0).default(0).messages({
    "number.min": "Cleaning fee must be 0 or more",
  }),
  penalty: Joi.number().min(0).default(0).messages({
    "number.min": "Penalty must be 0 or more",
  }),
  other: Joi.number().min(0).default(0).messages({
    "number.min": "Other charges must be 0 or more",
  }),
});


const billMonthParamSchema = Joi.object({
  stallId: Joi.string().required(),
  billMonth: Joi.string()
    .pattern(/^\d{4}-\d{2}$/)
    .required()
    .messages({
      "string.pattern.base": "billMonth must be in yyyy-mm format",
      "any.required": "billMonth is required",
    }),
});

const centreIdParamSchema = Joi.object({
  centreId: Joi.string().required().messages({
    "any.required": "centreId is required in the URL",
  }),
});

const stallIdParamSchema = Joi.object({
  stallId: Joi.string().required().messages({
    "any.required": "stallId is required in the URL",
  }),
});

const agreementIdParamSchema = Joi.object({
  agreementId: Joi.string().required().messages({
    "any.required": "agreementId is required in the URL",
  }),
});

const reportIdParamSchema = Joi.object({
  reportId: Joi.string().required().messages({
    "any.required": "reportId is required in the URL",
  }),
});


function formatJoiError(error) {
  return error.details.map((detail) => detail.message).join(", ");
}

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: formatJoiError(error) });
    }
    req.body = value;
    next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.params, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: formatJoiError(error) });
    }
    next();
  };
}

module.exports = {
  validateCreateRental: validateBody(createRentalSchema),
  validateSaveBillBody: validateBody(saveBillSchema),
  validateSaveBillParams: validateParams(billMonthParamSchema),
  validateCentreIdParam: validateParams(centreIdParamSchema),
  validateStallIdParam: validateParams(stallIdParamSchema),
  validateAgreementIdParam: validateParams(agreementIdParamSchema),
  validateReportIdParam: validateParams(reportIdParamSchema),
};