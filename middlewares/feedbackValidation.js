const Joi = require("joi");


const createComplaintSchema = Joi.object({
  stall: Joi.string().required(),
  stallName: Joi.string().allow("", null),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().required(),
  message: Joi.string().required(),
  image: Joi.string().allow("", null),
}).messages({
  "any.required": "Please fill in all fields.",
  "string.empty": "Please fill in all fields.",
});

const updateComplaintSchema = Joi.object({
  message: Joi.string().trim().min(1).required(),
}).messages({
  "string.empty": "Message cannot be empty.",
  "any.required": "Message cannot be empty.",
});

const createReviewSchema = Joi.object({
  stallId: Joi.string().required().messages({
    "any.required": "Please select a stall.",
    "string.empty": "Please select a stall.",
  }),
  rating: Joi.number().min(1).max(5).required().messages({
    "number.min": "Rating must be between 1 and 5.",
    "number.max": "Rating must be between 1 and 5.",
    "any.required": "Rating must be between 1 and 5.",
    "number.base": "Rating must be between 1 and 5.",
  }),
  reviewText: Joi.string().allow("", null),
  isAnonymous: Joi.any(),
  image: Joi.string().allow("", null),
  tags: Joi.array().items(Joi.string()).default([]),
});

const updateReviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required().messages({
    "number.min": "Rating must be between 1 and 5.",
    "number.max": "Rating must be between 1 and 5.",
    "any.required": "Rating must be between 1 and 5.",
    "number.base": "Rating must be between 1 and 5.",
  }),
  reviewText: Joi.string().trim().min(1).required().messages({
    "string.empty": "Review text cannot be empty.",
    "any.required": "Review text cannot be empty.",
  }),
  isAnonymous: Joi.any(),
  tags: Joi.array().items(Joi.string()).default([]),
});

const createCommentSchema = Joi.object({
  reviewId: Joi.string().required().messages({
    "any.required": "reviewId is required.",
    "string.empty": "reviewId is required.",
  }),
  commentText: Joi.string().trim().min(1).required().messages({
    "string.empty": "Comment cannot be empty.",
    "any.required": "Comment cannot be empty.",
  }),
});

const createReportSchema = Joi.object({
  reviewId: Joi.string().required().messages({
    "any.required": "reviewId is required.",
    "string.empty": "reviewId is required.",
  }),
  reason: Joi.string()
    .valid("Spam", "Inappropriate Content", "Fake Review", "Harassment", "Other")
    .required()
    .messages({
      "any.required": "Please select a reason.",
      "any.only": "Please select a reason.",
    }),
  details: Joi.string().allow("", null),
});

const complaintIdParamSchema = Joi.object({
  complaintId: Joi.string().required(),
});

const reviewIdParamSchema = Joi.object({
  reviewId: Joi.string().required(),
});


function formatJoiError(error) {
  const messages = [...new Set(error.details.map((detail) => detail.message))];
  return messages.join(", ");
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
  validateCreateComplaint: validateBody(createComplaintSchema),
  validateUpdateComplaint: validateBody(updateComplaintSchema),
  validateCreateReview: validateBody(createReviewSchema),
  validateUpdateReview: validateBody(updateReviewSchema),
  validateCreateComment: validateBody(createCommentSchema),
  validateCreateReport: validateBody(createReportSchema),
  validateComplaintIdParam: validateParams(complaintIdParamSchema),
  validateReviewIdParam: validateParams(reviewIdParamSchema),
};