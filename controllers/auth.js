// AUTH CONTROLLER

const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');

//Place Controller functions here - exports.get/post/etc

//Create a User
exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }
  const email = req.body.email;
  const name = req.body.name;
  const password = req.body.password;
  try {
    const hashedPw = await bcrypt.hash(password, 12);
    const user = new User({
      email: email,
      password: hashedPw,
      name: name
    });

    const result = await user.save();
    res.status(201).json({ message: 'User created!', userId: result._id });
  } catch {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

//
exports.login = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  let loadedUser;
  let isAdmin;
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error('A user with this email could not be found.');
      error.statusCode = 401;
      throw error;
    }
    loadedUser = user;

    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error('Wrong password');
      error.statusCode = 401;
      throw error;
    }
    const token = jwt.sign(
      { 
        email: loadedUser.email, 
        userId: loadedUser._id.toString()
      }, 
      'KateJenDanaHaileyJamieJennifer', 
      { expiresIn: '1h' }
    );

    if(loadedUser.admin) {
      isAdmin = loadedUser.admin;
    }
    else {
      isAdmin = false;
    }
    console.log(loadedUser.admin);

    res.status(200).json({ message: 'Logged in successfully.', token: token, 
      userId: loadedUser._id.toString(), isAdmin: isAdmin });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}

// Add to blacklist? 
// https://medium.com/devgorilla/how-to-log-out-when-using-jwt-a8c7823e8a6
// exports.postLogout = (req, res, next) => {
//   req.session.destroy(err => {
//     console.log(err);
//     res.redirect('/');
//   });
// };


exports.postReset = async (req, res, next) => {
    try {
      const user = await User.findOne({email: req.body.email});
      if (!user) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
      } 
      const currentPass = user.password;
      const token = jwt.sign(
        { 
          email: loadedUser.email, 
          userId: loadedUser._id.toString()
        }, 
        `secretpasswordsauce${currentPass}`, 
        { expiresIn: '20m' }
      );

      //send email? link provided will be http://localhost:3000/reset/${token}

      res.status(200).json({ message: 'Password reset request authorized', userId: loadedUser._id.toString() });
    } catch (err) {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    }
  }

//prior to rendering reset password form, frontend is verifying status of url parameter, :tokenId
exports.isPassLinkAuth = async (req, res, next) => {
  const token = tokenId;
  const userId  = await jwt.decode(token.userId);
  
  try {
    const passUser = await User.findById(userId);
    if(!passUser) {
      const error = new Error('No user found.');
      error.statusCode = 404;
      throw error;
    }

    const currentPass = passUser.password;
    const decodedToken = jwt.verify(token, `secretpasswordsauce${currentPass}`)
    if(!decodedToken) {
      const error = new Error('Not authenticated.');
      error.statusCode = 401;
      throw error;
    }

    //authentication reply allows frontend to render "set password" form with added layer of security
    res.status(200).json({message: 'User authenticated.', userId: req.userId.toString()})}
    
    catch {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    }
  };

//Create new password
exports.postNewPassword = async (req, res, next) => {
  const newPassword = req.body.password;
  const userId = req.body.userId;

  try {
    const resetUser = await User.findOne({
      _id: userId
    });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    resetUser.password = hashedPassword;

    await resetUser.save();
    res.status(200).json({ message: 'Password reset successfully', userId: resetUser._id.toString() });
  } catch {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};