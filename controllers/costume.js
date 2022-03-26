// COSTUME CONTROLLER

const {
  validationResult
} = require('express-validator');
const io = require('../socket');

const Costume = require('../models/costume');
const User = require('../models/user');
const Rental = require('../models/rental');

const stripe = require('stripe')(process.env.STRIPE_KEY);

// Place Controller functions here:


// GET EXPORTS:

//Get the list of costumes
exports.getCostumes = async (req, res, next) => {
  const page = +req.query.page || 1;
  const perPage = 3;
  try {
    const totalItems = await Costume.find().countDocuments()
    if (!totalItems) {
      const error = new Error('No costumes found!');
      error.statusCode = 404;
      throw error;
    }
    const costumes = await Costume.find()
      .skip((page - 1) * perPage)
      .limit(perPage);
    if (!costumes) {
      const error = new Error('No costumes found!');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({
      message: 'Fetched costumes successfully.',
      costumes: costumes,
      totalItems: totalItems
    })
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err)
  }
};

//Get the details of a single costume by costume id
exports.getCostume = async (req, res, next) => {
  const costumeId = req.params.costumeId;

  try {
    const costume = await Costume.findById(costumeId)
    if (!costume) {
      const error = new Error('Could not find costume');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({
      message: 'Costume Found',
      costume: costume
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}

//Get the user's cart info for added costumes in the cart
exports.getCart = async (req, res, next) => {
  const userId = req.userId;
  let cartUser = await User.findOne({_id: userId});
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }
  try {
    await cartUser.cart.populate('items.costumeId');
    if (!cartUser.cart) {
      const error = new Error('No items in cart!');
      error.statusCode = 404;
      throw error;
    }
    const costumes = cartUser.cart.items;
    res.status(200).json({
      pageTitle: 'Your Cart',
      costumes: costumes
    }); 
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}


// TODO: Checkout needs fixed-please help:)
//Get checkout for payments
exports.getCheckout = async (req, res, next) => {
  try {
    const checkoutUser = await User.findById(req.userId);    

    await checkoutUser.cart.populate('items.costumeId');
    if (!checkoutUser.cart) {
      const error = new Error('No items in cart!');
      error.statusCode = 404;
      throw error;
    }
    const costumes = checkoutUser.cart.items;

    const lineItems = costumes.map( p => { 
      return { 
        price_data: {
        currency: 'usd',
        product_data: {
         name: p.costumeId.costumeName},
        unit_amount: p.costumeId.rentalFee * 100},
        quantity: p.quantity,}
      })

      console.log(lineItems);

    const paymentResult = await stripe.checkout.sessions.create({
      customer: `cus_LOFVQN9eFCDXMJ`,
      payment_method_types: ['card'],
      line_items: lineItems,   
      mode: 'payment', 
      success_url: req.protocol + '://' + 'localhost:3000' + '/checkout/success', // => http://localhost:3000
      cancel_url: req.protocol + '://' + 'localhost:3000' + '/checkout/cancel'})

      console.log(paymentResult);
    return res.status(200).json({
      message: 'Payment session initiated', url: paymentResult.url})
  } 
  catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// TODO: Checkout needs fixed-please help:) 
// TODO: Convert to async/await
// Gets successful checkout and clears user cart
exports.getCheckoutSuccess = async (req, res, next) => {
  try {

  const checkoutUser = await User.findById(req.userId);
  console.log('FOUND USER:', checkoutUser.email);
  const cartItems = await  checkoutUser.cart.populate('items.costumeId');
  console.log('POPULATED CART:', cartItems.length);
  const costumes = checkoutUser.cart.items.map(i => {
        return { quantity: i.quantity, costume: { ...i.costumeId._doc } };
      });

  console.log('MAPPED COSTUMES:', costumes);
  
  const rental = new Rental({
        user: {
          email: checkoutUser.email,
          userId: req.userId
        },
        costumes: costumes
      });

  console.log('CREATED RENTAL ORDER:', rental);
  
  const completedRental = await rental.save();
  await checkoutUser.clearCart();

  return res.status(200).json({message: 'Rental placed successfully!', rental: completedRental._doc });
  }
    catch(err) {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    }
}

// // Jennifer's checkout exports
// // getCheckout is for payments
// exports.getCheckout = (req, res, next) => {
//   let products;
//   let total = 0;
//   req.user
//   .populate('cart.items.productId')
//   .then(user => {
//     products = user.cart.items;
//     total = 0;
//     products.forEach(p => {
//       total += p.quantity * p.productId.price;
//     });

//     return stripe.checkout.sessions.create({
//       payment_method_types: ['card'], 
//       line_items: products.map(p => {
//         return {
//           name: p.productId.title,
//           description: p.productId.description,
//           amount: p.productId.price * 100,
//           currency: 'usd', 
//           quantity: p.quantity
//         };
//       }),
//       success_url: req.protocol + '://' + req.get('host') + '/checkout/success',
//       cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel'
//     });
//   })
//   .then(session => {
//     res.render('shop/checkout', {
//       path: '/checkout',
//       pageTitle: 'Checkout',
//       products: products,
//       totalSum: total,
//       sessionId: session.id
//     });
//   })
//   .catch(err => {
//     const error = new Error(err);
//     error.httpStatusCode = 500;
//     return next(error);
//   });
// }


// exports.getCheckoutSuccess = (req, res, next) => {
//   req.user
//     .populate('cart.items.productId')
//     // .execPopulate()
//     .then(user => {
//       const products = user.cart.items.map(i => {
//         return { quantity: i.quantity, product: { ...i.productId._doc } };
//       });
//       const order = new Order({
//         user: {
//           email: req.user.email,
//           userId: req.user
//         },
//         products: products
//       });
//       return order.save();
//     })
//     .then(result => {
//       return req.user.clearCart();
//     })
//     .then(() => {
//       return res.redirect('/orders');
//     })
//     .catch(err => {
//       const error = new Error(err);
//       error.httpStatusCode = 500;
//       return next(error);
//     });
// };
// End Jennifer's checkout exports


//Get rentals for a user
exports.getRentals = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }
  try {
    const rentals = Rental.find({
      'user.userId': req.user._id
    });

    res.status(200)({
      pageTitle: 'Your Rentals',
      rentals: rentals
    })
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}

// TODO: Stretch: Invoice?
//Get invoice for rental
exports.getInvoice = async (req, res, next) => {}


// POST EXPORTS:

//Add a costume to the cart
exports.postCart = async (req, res, next) => {
  const costumeId = req.body.costumeId;
  const userId = req.body.userId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }
  try {
    const reqUser = await User.findById(userId);
    if(!reqUser) {
      const error = new Error('Cannot locate user for cart.');
      error.statusCode = 404;
      throw error;}

    console.log(req.body);
    const cartCostume = await Costume.findById(costumeId);
    if (!cartCostume) {
      console.log(costumeId)
      const error = new Error('Cannot locate costume for cart.');
      error.statusCode = 404;
      throw error;}  

    await reqUser.addToCart(cartCostume);

    res.status(200).json({
      message: 'Costume added to cart',
      costumeId: costumeId,
      userId: req.userId,
      cart: reqUser.cart.items
    })
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// TODO: This route is not needed if using checkout process routes 
// //Create an order
// exports.postRental = async (req, res, next) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     const error = new Error('Validation failed.');
//     error.statusCode = 422;
//     error.data = errors.array();
//     throw error;
//   }
//   try {
//     const user = await req.user.populate('cart.items.costumeId')
//     const costumes = User.cart.items.map(i => {
//       return {
//         quantity: i.quantity,
//         costume: {
//           ...i.costumeId._doc
//         }
//       };

//     });
//     const rental = new Rental({
//       user: {
//         name: req.user.name,
//         userId: req.userId
//       },
//       costumes: costumes
//     });
//     await rental.save();
//     await req.user.clearCart();
//     res.status(200).json({
//       message: 'Rental placed successfully!'
//     })
//   } catch (err) {
//     if (!err.statusCode) {
//       err.statusCode = 500;
//     }
//     next(err);
//   }
// };


// DELETE EXPORTS
//Remove costume from cart
exports.deleteCostumeFromCart = async (req, res, next) => {
  const costumeId = req.body.costumeId;
  console.log('REQUEST BODY:', req.body );
  console.log("made it to the controller!", costumeId);
  if(!costumeId) {
    return res.status(404).json({message:'No costumeId in request body!'});
  }
  try {
    const cartUser = await User.findById(req.userId);
    console.log('Found a user!', cartUser.email);
    await cartUser.removeFromCart(costumeId);
    res.status(200).json({
      message: 'Costume deleted from cart',
      costumeId: costumeId,
      userId: req.userId
    })
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}; 

// exports.deletePost = async (req, res, next) => {
//   const postId = req.params.postId;
//   try {
//     const post = await Post.findById(postId)
//     if (!post) {
//       const error = new Error('Could not find post.');
//       error.statusCode = 404;
//       throw error;
//     }
//     if (post.creator.toString() !== req.userId) {
//       const error = new Error('Not authorized!');
//       error.statusCode = 403;
//       throw error;
//     }
//     // Check logged in user
//     await Post.findByIdAndRemove(postId);

//     const user = await User.findById(req.userId);
//     user.posts.pull(postId);

//     await user.save();
//     io.getIO().emit('posts', { action: 'delete', post: postId });
//     res.status(200).json({ message: 'Deleted post.' });
//   } catch {
//     if (!err.statusCode) {
//       err.statusCode = 500;
//     }
//     next(err);
//   }  
// }

// exports.postCartDeleteProduct = (req, res, next) => {
//   const prodId = req.body.productId;
//   req.user
//     .removeFromCart(prodId)
//     .then(result => {
//       res.redirect('/cart');
//     })
//     .catch(err => {
//       const error = new Error(err);
//       error.httpStatusCode = 500;
//       return next(error);
//     });
// };