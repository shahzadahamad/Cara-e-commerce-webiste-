const Razorpay = require("razorpay");
const { default: mongoose } = require("mongoose");
const cart = require("../../models/cartModel");
const Address = require("../../models/addressModel");
const Order = require("../../models/orderModel");
const Product = require("../../models/productsModel");
const totalPrice = require("../../controllers/user/cartController");
const Payment = require("../../models/paymentModel");
const Coupon = require("../../models/couponModel");
const Offer = require("../../models/offerModel");
const Wallet = require("../../models/walletModel");
const Category = require("../../models/categoryModel");
const moment = require("moment");

// razorpay insatnce
const razorpay = async () => {
  const { key_id, key_secret } = process.env;

  const razorpayInstance = new Razorpay({
    key_id: key_id,
    key_secret: key_secret,
  });

  return razorpayInstance;
};

// decremting the product quantity
const decrementProductQuatity = async (id) => {
  try {
    const cartPro = await cart
      .findOne({ userId: id }, { products: 1 })
      .populate("products.productId");

    cartPro.products.forEach(async (x) => {
      const productQuantity = await Product.findOne({ _id: x.productId });
      const store = productQuantity.quantity - x.quantity;
      await Product.updateOne(
        { _id: x.productId._id },
        { $set: { quantity: store } }
      );
    });

    const currentDate = new Date();
    for (const product of cartPro.products) {
      const productDetails = await Product.findById(product.productId);
      let maxDiscount = 0;

      if (productDetails.offer) {
        const productOffer = await Offer.findById(productDetails.offer);
        if (productOffer.discountPercentage > maxDiscount) {
          const offerStartDate = new Date(productOffer.startDate);
          const offerEndDate = new Date(productOffer.endDate);

          offerStartDate.setHours(0, 0, 0, 0);
          offerEndDate.setHours(23, 59, 59, 999);

          if (currentDate >= offerStartDate && currentDate <= offerEndDate) {
            maxDiscount = productOffer.discountPercentage;
          }
        }
      }

      if (productDetails.categoryId) {
        const category = await Category.findById(productDetails.categoryId);
        if (category.offer) {
          const categoryOffer = await Offer.findById(category.offer);
          if (categoryOffer.discountPercentage > maxDiscount) {
            const offerStartDate = new Date(categoryOffer.startDate);
            const offerEndDate = new Date(categoryOffer.endDate);

            offerStartDate.setHours(0, 0, 0, 0);
            offerEndDate.setHours(23, 59, 59, 999);

            if (currentDate >= offerStartDate && currentDate <= offerEndDate) {
              maxDiscount = categoryOffer.discountPercentage;
            }
          }
        }
      }

      let productPrice = productDetails.price;

      if (maxDiscount > 0) {
        productPrice -= Math.round((productPrice * maxDiscount) / 100);
      }

      let productPriceFinal = productPrice;

      const price = productPriceFinal;

      await cart.updateOne(
        { userId: id, "products._id": product._id },
        { $set: { "products.$.price": price } }
      );
    }

    const cartProducts = await cart
      .findOne({ userId: id }, { products: 1 })
      .populate("products.productId");
    return cartProducts;
  } catch (error) {
    console.log(error.message);
  }
};

// payment detials saving in database
const paymentDetials = async (
  transactionId,
  userId,
  orderId,
  amount,
  method
) => {
  try {
    const payment = new Payment({
      userId: userId,
      orderId: orderId,
      amount: amount,
      paymentMethod: method,
      transactionId: method === "COD" ? "COD" : transactionId,
      status: method === "COD" ? "Pending" : "Success",
      createdDate: new Date(),
    });

    await payment.save();
  } catch (error) {
    console.log(error.message);
  }
};

// checkout
const loadCheckout = async (req, res) => {
  try {
    const cartPro = await cart.findOne({ userId: req.session.user._id });
    if (cartPro) {
      const coupons = await Coupon.find({});
      const address = await Address.findOne({ userId: req.session.user._id });
      const products = await cart
        .findOne({ userId: req.session.user._id })
        .populate({
          path: "products.productId",
          populate: {
            path: "offer",
          },
        })
        .populate({
          path: "products.productId",
          populate: {
            path: "categoryId",
            populate: {
              path: "offer",
            },
          },
        });
      const totalCart = await totalPrice.totalCartPrice(req.session.user._id);
      const message = req.flash("message");
      const message1 = req.flash('message1')
      res.render("checkout", {
        user: req.session.user,
        address: address,
        product: products,
        total: totalCart[0].total,
        data: new Date(),
        message,
        message1,
        couponApplied: req.session.coupon ? req.session.coupon : false,
        coupons,
      });
    } else {
      res.redirect('/cart');
    }
  } catch (error) {
    console.log(error.message);
  }
};

// verify Razorpay
const verifyRazorpay = async (req, res) => {
  try {
    const amount = await totalPrice.totalCartPrice(req.session.user._id);
    const shipping =
      amount[0].total < 500 ? amount[0].total + 40 : amount[0].total;
    const discount = req.session.coupon
      ? shipping - req.session.coupon.discountAmount
      : shipping;
    const totalAmount = Number(discount) * 100;

    const razorpayInstance = await razorpay();

    const options = {
      amount: totalAmount,
      currency: "INR",
    };

    razorpayInstance.orders.create(options, (err, order) => {
      if (!err) {
        res.status(200).send({
          key: razorpayInstance.key_id,
          orderId: order.id,
          amount: totalAmount,
          cusName: req.session.user.fullname,
          cusEmail: req.session.user.email,
          cusContact: req.session.user.mobile,
        });
      } else {
        res.status(400).send({ msg: "Something went wrong!" });
        console.log(err);
      }
    });
  } catch (error) {
    console.log(error.message);
  }
};

// razrpay success req
const razorpaySuccess = async (req, res) => {
  try {
    const { id, transactionId } = req.body;

    const address = await Address.findOne(
      { userId: req.session.user._id },
      { address: { $elemMatch: { _id: id } } }
    );

    const cartPro = await decrementProductQuatity(req.session.user._id);
    const totalCart = await totalPrice.totalCartPrice(req.session.user._id);

    const shipping =
      totalCart[0].total < 500 ? totalCart[0].total + 40 : totalCart[0].total;
    const discount = req.session.coupon
      ? shipping - req.session.coupon.discountAmount
      : shipping;

    const order = new Order({
      userId: req.session.user._id,
      orderAmount: discount,
      couponApplied: req.session.coupon
        ? req.session.coupon.discountAmount
        : "",
      deliveryAddress: address.address[0],
      paymentMethod: "Online",
      orderItems: cartPro.products,
      orderStatus: "Pending",
      orderDate: new Date(),
    });

    if (!req.session.coupon) {
      delete order.couponApplied;
    }

    if (order.couponApplied) {
      await Coupon.updateOne(
        { _id: req.session.coupon },
        { $inc: { quantity: -1 } }
      );
    }

    await paymentDetials(
      transactionId,
      order.userId,
      order._id,
      order.orderAmount,
      order.paymentMethod
    );

    await order.save();

    await cart.deleteOne({ userId: req.session.user._id });
    delete req.session.coupon;
    res.send({ status: true });
  } catch (error) {
    console.log(error.message);
  }
};

// razorpayFalied
const razorpayFalied = async (req, res) => {
  try {
    const { selectedAddress } = req.body;
    const address = await Address.findOne(
      { userId: req.session.user._id },
      { address: { $elemMatch: { _id: selectedAddress } } }
    );

    const cartPro = await cart
      .findOne({ userId: req.session.user._id }, { products: 1 })
      .populate("products.productId");
    const totalCart = await totalPrice.totalCartPrice(req.session.user._id);
    const shipping =
      totalCart[0].total < 500 ? totalCart[0].total + 40 : totalCart[0].total;
    const discount = req.session.coupon
      ? shipping - req.session.coupon.discountAmount
      : shipping;

    const order = new Order({
      userId: req.session.user._id,
      orderAmount: discount,
      couponId: req.session.coupon ? req.session.coupon._id : null,
      couponApplied: req.session.coupon
        ? req.session.coupon.discountAmount
        : "",
      deliveryAddress: address.address[0],
      paymentMethod: "Online",
      orderItems: cartPro.products,
      orderStatus: "Payment Failed",
      orderDate: new Date(),
    });

    if (!req.session.coupon) {
      delete order.couponId;
      delete order.couponApplied;
    }

    await order.save();
    await cart.deleteOne({ userId: req.session.user._id });
    delete req.session.coupon;
    res.send({ status: true });
  } catch (error) {
    console.log(error);
  }
};

// verifly checkout
const verifyCheckout = async (req, res) => {
  try {
    const { selectedPaymentMethod, selectedAddress } = req.body;

    const totalCart = await totalPrice.totalCartPrice(req.session.user._id);

    const shipping =
      totalCart[0].total < 500 ? totalCart[0].total + 40 : totalCart[0].total;
    const discount = req.session.coupon
      ? shipping - req.session.coupon.discountAmount
      : shipping;

    if (discount > 1000 && selectedPaymentMethod === "COD") {
      req.flash(
        "message",
        "Cash On Delivery is not available for orders below ₹1000."
      );
      return res.redirect("/checkout");
    }

    if (!selectedAddress) {
      req.flash("message", "please select address");
      return res.redirect("/checkout");
    }

    if (!selectedPaymentMethod) {
      req.flash("message", "please select payment method");
      return res.redirect("/checkout");
    }

    const address = await Address.findOne(
      { userId: req.session.user._id },
      { address: { $elemMatch: { _id: selectedAddress } } }
    );

    // decrementing the product quantity
    const cartPro = await decrementProductQuatity(req.session.user._id);

    const order = new Order({
      userId: req.session.user._id,
      orderAmount: discount,
      couponApplied: req.session.coupon
        ? req.session.coupon.discountAmount
        : "",
      deliveryAddress: address.address[0],
      paymentMethod: selectedPaymentMethod,
      orderItems: cartPro.products,
      orderStatus: selectedPaymentMethod === "COD" ? "Placed" : "Pending",
      orderDate: new Date(),
    });

    if (!req.session.coupon) {
      delete order.couponApplied;
    }

    await paymentDetials(
      false,
      order.userId,
      order._id,
      order.orderAmount,
      order.paymentMethod
    );

    if (selectedPaymentMethod === "COD") {
      if (order.couponApplied) {
        await Coupon.updateOne(
          { _id: req.session.coupon },
          { $inc: { quantity: -1 } }
        );
      }

      await order.save();
      await cart.deleteOne({ userId: req.session.user._id });
      delete req.session.coupon;
      res.redirect("/order-confirm/#page-header");
    } else if (selectedPaymentMethod === "Wallet") {
      const balaceWallat = await Wallet.findOne({
        userId: req.session.user._id,
      });
      if (!balaceWallat) {
        req.flash("message", "No Balace in Wallat");
        return res.redirect("/checkout");
      }
      if (balaceWallat && balaceWallat.totalAmount < order.orderAmount) {
        req.flash("message", "No Balace in Wallat");
        return res.redirect("/checkout");
      } else {
        const update = {
          type: "Debit",
          amount: order.orderAmount,
          reason: "Purchase Product",
          transactionDate: new Date(),
        };
        await Wallet.updateOne(
          { userId: req.session.user._id },
          { $inc: { totalAmount: -order.orderAmount } }
        );
        await Wallet.updateOne(
          { userId: req.session.user._id },
          { $push: { transactions: update } }
        );
        await order.save();
        await cart.deleteOne({ userId: req.session.user._id });
        delete req.session.coupon;
        res.redirect("/order-confirm/#page-header");
      }
    }
  } catch (error) {
    console.log(error.message);
  }
};

// verify cart checkout
const verifyCartCheckout = async (req, res) => {
  try {
    res.redirect("/checkout");
  } catch (error) {
    console.log(error.message);
  }
};

// loadOrder page
const loadOrder = async (req, res) => {
  try {
    const { falied } = req.query;
    if (falied) {
      res.render("order", { user: req.session.user, falied: true });
    } else {
      res.render("order", { user: req.session.user, falied: false });
    }
  } catch (error) {
    console.log(error.message);
  }
};

// verifying coupon
const verifyCoupon = async (req, res) => {
  try {
    const { inputVal } = req.body;
    if (req.session.coupon) {
      return res.json({ remove: true });
    }
    const coupon = await Coupon.findOne({ couponCode: inputVal });
    if (coupon) {
      const totalCart = await totalPrice.totalCartPrice(req.session.user._id);
      const total =
        totalCart[0].total < 500 ? totalCart[0].total + 40 : totalCart[0].total;
      if (total <= coupon.discountAmount || coupon.quantity <= 0) {
        return res.json({ status: "Invalied Coupon" });
      }
      req.session.coupon = coupon;
      res.json({ amount: coupon.discountAmount });
    } else {
      res.json({ status: "Invalied Coupon" });
    }
  } catch (error) {
    console.log(error.message);
  }
};

// delteing coupon Session
const deleteSession = async (req, res) => {
  try {
    delete req.session.coupon;
    const totalCart = await totalPrice.totalCartPrice(req.session.user._id);
    res.json({
      status: true,
      total:
        totalCart[0].total < 500 ? totalCart[0].total + 40 : totalCart[0].total,
    });
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  loadCheckout,
  loadCheckout,
  loadOrder,
  verifyCheckout,
  verifyCartCheckout,
  verifyRazorpay,
  razorpaySuccess,
  razorpay,
  verifyCoupon,
  deleteSession,
  razorpayFalied,
  paymentDetials,
};
