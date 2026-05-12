

const validate = (schema) => async (req, res, next) => {
  try {
    await schema.parseAsync(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.errors?.[0]?.message || "Validation failed",
    });
  }
};

export default validate;