const user = require("../../models/userModel");
const userOTPVerification = require("../../models/userOTPVerificationModel");
const product = require("../../models/productsModel");
const category = require("../../models/categoryModel");
const Wishlist = require("../../models/wishlistModel");
const Referral = require("../../models/refferalModel");
const bcrypt = require("bcryptjs");
const nodeMailer = require("nodemailer");
const { render, name } = require("ejs");
const { default: mongoose } = require("mongoose");
const { CategoryScale } = require("chart.js");

// loadHome
const loadPage = (req, res) => {
  try {
    res.redirect("/home");
  } catch (error) {
    console.log(error.message);
  }
};

// loadHome
const loadHome = async (req, res) => {
  try {
    const productData = await product
      .find()
      .limit(8)
      .populate("offer")
      .populate({ path: "categoryId", populate: { path: "offer" } });
    const latestProducts = await product
      .find()
      .sort({ _id: -1 })
      .limit(8)
      .populate("offer")
      .populate({ path: "categoryId", populate: { path: "offer" } });
    if (req.session.user) {
      const existingWishlistPro = await Wishlist.find({
        userId: req.session.user._id,
      });
      res.render("home", {
        login: req.session.user,
        product: productData,
        latestProducts: latestProducts,
        existWishlist: existingWishlistPro[0] ? existingWishlistPro[0].products : false,
        data: new Date(),
      });
    } else {
      res.render("home", {
        login: req.session.user,
        product: productData,
        latestProducts: latestProducts,
        data: new Date(),
      });
    }
  } catch (error) {
    console.log(error.message);
  }
};

// searchFillting
const searchFillter = async (name, brand) => {
  try {
    if (name) {
      const fillteredProducts = await product
        .find({ name: name })
        .populate("offer")
        .populate({ path: "categoryId", populate: { path: "offer" } });
      return fillteredProducts;
    } else if (brand) {
      const fillteredProducts = await product
        .find({ brand: brand })
        .populate("offer")
        .populate({ path: "categoryId", populate: { path: "offer" } });
      return fillteredProducts;
    }
  } catch (error) {
    console.log(error.message);
  }
};

// loadShop
const loadShop = async (req, res) => {
  try {
    const categorys = await category.find();
    const { id, nameSearch, brandSearch, results, value } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const startIndex = (page-1)*limit;
    if (req.session.user) {
      const existingWishlistPro = await Wishlist.find({userId:req.session.user._id});
      if (results) {
        const decodedProducts = JSON.parse(
          decodeURIComponent(Buffer.from(results, "base64").toString("utf-8"))
        );
        return res.render("shop", {
          login: req.session.user,
          product: decodedProducts,
          category: categorys,
          existWishlist: existingWishlistPro[0] ? existingWishlistPro[0].products : false,
          selectedSearch: value,
          currentPage : page,
          data: new Date(),
        });
      }

      if (nameSearch || brandSearch) {
        const filltered = await searchFillter(nameSearch, brandSearch);
        return res.render("shop", {
          login: req.session.user,
          product: filltered,
          category: categorys,
          existWishlist: existingWishlistPro[0] ? existingWishlistPro[0].products : falses,
          selectedSearch: nameSearch ? nameSearch : brandSearch,
          currentPage : page,
          data: new Date(),
        });
      }

      if (id && id !== "allCategory") {
        const selectedCategory = await product
          .find({ categoryId: id }).skip(startIndex).limit(limit)
          .populate("offer")
          .populate({ path: "categoryId", populate: { path: "offer" } });

        return res.render("shop", {
          login: req.session.user,
          product: selectedCategory,
          category: categorys,
          existWishlist: existingWishlistPro[0] ? existingWishlistPro[0].products : false,
          currentPage : page,
          data: new Date(),
        });
      } else {
        const productData = await product
          .find().skip(startIndex).limit(limit)
          .populate("offer")
          .populate({
            path: "categoryId",
            select: "-name",
            populate: { path: "offer" },
          });
        return res.render("shop", {
          login: req.session.user,
          product: productData,
          category: categorys,
          existWishlist:existingWishlistPro[0] ? existingWishlistPro[0].products : false,
          id: id,
          currentPage : page,
          data: new Date(),
        });
      }
    } else {
      if (results) {
        const decodedProducts = JSON.parse(
          decodeURIComponent(Buffer.from(results, "base64").toString("utf-8"))
        );
        return res.render("shop", {
          login: req.session.user,
          product: decodedProducts,
          category: categorys,
          selectedSearch: value,
          currentPage : page,
          data: new Date(),
        });
      }

      if (nameSearch || brandSearch) {
        const filltered = await searchFillter(nameSearch, brandSearch);
        return res.render("shop", {
          login: req.session.user,
          product: filltered,
          category: categorys,
          selectedSearch: nameSearch ? nameSearch : brandSearch,
          currentPage : page,
          data: new Date(),
        });
      }

      if (id && id !== "allCategory") {
        const selectedCategory = await product
          .find({ categoryId: id }).skip(startIndex).limit(limit)
          .populate("offer")
          .populate({ path: "categoryId", populate: { path: "offer" } });
        return res.render("shop", {
          login: req.session.user,
          product: selectedCategory,
          category: categorys,
          currentPage : page,
          data: new Date(),
        });
      } else {
        const productData = await product
          .find().skip(startIndex).limit(limit)
          .populate("offer")
          .populate({
            path: "categoryId",
            select: "-name",
            populate: { path: "offer" },
          });
        return res.render("shop", {
          login: req.session.user,
          product: productData,
          category: categorys,
          id: id,
          currentPage : page,
          data: new Date(),
        });
      }
    }
  } catch (error) {
    console.log(error.message);
  }
};

// shop search verify
const verifyShopSearch = async (req, res) => {
  try {
    const { value } = req.body;

    const regex = new RegExp(value, "i");
    const products = await product
      .find({ $or: [{ name: regex }, { brand: regex }] }, { description: 0 })
      .populate("offer")
      .populate({ path: "categoryId", populate: { path: "offer" } });
    const encodedProducts = Buffer.from(JSON.stringify(products)).toString(
      "base64"
    );

    res.redirect(
      `/shop?value=${value}&results=${encodeURIComponent(encodedProducts)}`
    );
  } catch (error) {
    console.log(error.message);
  }
};

// search
const loadSearch = async (req, res) => {
  try {
    const { data, categorys } = req.query;
    const categoryFind = await category.findOne({ name: categorys });

    if (categoryFind) {
      const products = await product.find({
        $or: [
          { name: { $regex: data, $options: "i" } },
          { brand: { $regex: data, $options: "i" } },
        ],
        categoryId: categoryFind._id,
      });
      res.send({ products });
    } else {
      
      const products = await product.find({
        $or: [
          { name: { $regex: data, $options: "i" } },
          { brand: { $regex: data, $options: "i" } },
        ],
      });
      res.send({ products });
    }
  } catch (error) {
    console.log(error.message);
  }
};

// loadAbout
const loadAbout = (req, res) => {
  try {
    res.render("about", { login: req.session.user });
  } catch (error) {
    console.log(error.message);
  }
};

// loadSingleProduct
const loadSingleProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const sproduct = await product
      .findById({ _id: id })
      .populate("offer")
      .populate({ path: "categoryId", populate: { path: "offer" } });
    const relatedProduct = await product
      .find({
        categoryId: sproduct.categoryId,
        brand: sproduct.brand,
      })
      .populate("offer")
      .populate({ path: "categoryId", populate: { path: "offer" } });

      if(req.session.user){
        const existingWishlistPro = await Wishlist.find({userId:req.session.user._id});
        res.render("sproduct", {
          login: req.session.user,
          sproduct: sproduct,
          related: relatedProduct,
          existWishlist: existingWishlistPro[0] ? existingWishlistPro[0].products : false,
          data: new Date(),
        });
      }else{
        res.render("sproduct", {
          login: req.session.user,
          sproduct: sproduct,
          related: relatedProduct,
          data: new Date(),
        });
      }
  } catch (error) {
    console.log(error.message);
  }
};

// loadProfile
const loadProfile = async (req, res) => {
  try {
    const userData = await user.findOne({ _id: req.session.user._id });
    const message = req.flash("message");
    res.render("profile", { user: userData, message });
  } catch (error) {
    console.log(error.message);
  }
};

// Edit user
const loadEditUser = async (req, res) => {
  try {
    const userData = await user.findOne({ _id: req.session.user._id });
    res.render("edit-user", { user: userData });
  } catch (error) {
    console.log(error.message);
  }
};

// verify edituser page
const verifyEditUser = async (req, res) => {
  try {
    const { name, email, mobile } = req.body;
    const update = {
      fullname: name,
      email: email,
      mobile: mobile,
    };
    const updateUser = await user.updateOne(
      { _id: req.session.user._id },
      { $set: update }
    );

    req.flash("message", "Profile edited");
    res.redirect("/profile");
  } catch (error) {
    console.log(error.message);
  }
};

const loadRefer = async (req, res) => {
  try {
    const refferal = await Referral.findOne({ userId: req.session.user._id });
    const userData = await user.findOne({ _id: req.session.user._id });
    res.render("refer", { user: userData, refferal: refferal });
  } catch (error) {
    console.log(error.message);
  }
};

const verifyRefferal = async (req, res) => {
  try {
    const { ref } = req.query;
    if (ref) {
      res.redirect(`/signup?ref=${ref}`);
    } else {
      res.redirect("/home");
    }
  } catch (error) {
    console.log(error.message);
  }
};

module.exports = {
  loadPage,
  loadHome,
  loadShop,
  loadAbout,
  loadSingleProduct,
  loadProfile,
  loadEditUser,
  verifyEditUser,
  loadSearch,
  verifyShopSearch,
  loadRefer,
  verifyRefferal,
};
