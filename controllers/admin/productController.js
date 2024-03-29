const admin = require("../../models/adminModel");
const multer = require("../../middleware/multer");
const product = require("../../models/productsModel");
const category = require("../../models/categoryModel");
const fs = require('fs');
const path = require('path');
const imagePath = path.join(__dirname,'../../public/images/productImages/');
const mongoose = require("mongoose");

// validation for product adding and editing
const validationFunction = (name, brand,rating, price, quantity, description,categoryy,files,addProductChecking) => {
  if (
    !name ||
    !brand ||
    !price ||
    !quantity ||
    !description
  ) {
   return 'All Fields Are Require!'
  }

  if(!categoryy || categoryy==='Category'){
    return 'Select Category!'
  }

  if(!rating || rating==='Rating'){
    return 'Select Rating!'
  }

  const quantityValue = parseFloat(quantity);
  const priceValue = parseFloat(price);
  if (isNaN(quantityValue) || quantity < 0){
    return 'Quantity must be a positive Integer!'
  }

  if(isNaN(priceValue)||price<0){
    return 'Price must be a positive Integer!'
  }

  if(addProductChecking){
    if (!files || files.length === 0) {
      return 'Images are required!'
    };
  
    if(files.length>4){
      return 'Please select a maximum of 4 images!'
    };
  
    if(files.length<=0){
      return 'Please select a minimum of 1 image!'
    }
  }

  return {status:true};
}

// removing image form the files
function deleteImageFromFile(files){
  files.forEach(element => {
    fs.unlink(imagePath+element.filename,(err)=>{
      if(err){
        console.log(err.message);
      }
    });
  });
}

// loadProducts
const loadProducts = async (req, res) => {
  try {
    const adminData = await admin.findById({ _id: req.session.admin_id });
    const page = 1;
    const limit = 10;
    const startIndex = (page-1)*limit;
    const products = await product.find().populate('categoryId').sort({_id:-1}).skip(startIndex).limit(limit);
    const AlltotalProductsCount = await product.countDocuments();
    const hasNextPage = AlltotalProductsCount > limit * page;
    res.render("products", { admins: adminData, product: products,hasNextPage,AlltotalProductsCount});
  } catch (error) {
    console.log(error.message);
  }
};

// loadAddProducts
const loadAddProducts = async (req, res) => {
  try {
    const { message, message1 } = req.flash();
    const adminData = await admin.findById({ _id: req.session.admin_id });
    const categorys = await category.find();

    res.render("addProducts", {
      admins: adminData,
      category: categorys,
      message,
      message1,
    });
  } catch (error) {
    console.log(error.message);
  }
};

// verifyAddProducts
const verifyAddProducts = async (req, res) => {
  try {
    const { name, brand,rating, price, quantity, description } = req.body;
    const existingProduct = await product.findOne({ name: name });
    if (existingProduct) {
      deleteImageFromFile(req.files);
      return res.json({msg:'Product Already Exist! Use Another Name'});
    }

    const validation =  validationFunction(name, brand,rating, price, quantity, description,req.body.category,req.files,true);

    if(validation.status){
      const categorys = await category.findOne({ name: req.body.category });

      const images = [];
      const files = req.files;
  
      files.forEach((files) => {
        images.push(files.filename);
      });
  
      const addProduct = new product({
        name: name,
        brand: brand,
        categoryId: categorys._id,
        rating: rating,
        price: price,
        quantity: quantity,
        image: images,
        description: description,
      });
  
      await addProduct.save()
      res.json({status:true});
    }else{
      deleteImageFromFile(req.files);
      res.json({msg:validation});
    }

  } catch (error) {
    console.log(error.message);
  }
};

// loadEditProduct
const loadEditProduct = async (req, res) => {
  try {
    const adminData = await admin.findById({ _id: req.session.admin_id });
    const categorys = await category.find();
    const { message, message1 } = req.flash();
    const id = req.query.id;
    const productId = await product
      .findById({ _id: id })
      .populate("categoryId");

    res.render("editProduct", {
      admins: adminData,
      category: categorys,
      product: productId,
      message,
      message1,
    });
  } catch (error) {
    console.log(error.message);
  }
};

// verifyEditProduct
const verifyEditProduct = async (req, res) => {
  try {
    const { name, brand, rating, price, quantity, description } = req.body;
    const id = req.query.id;

    const existingProduct = await product.findOne({
      name: name,
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res.json({msg:'Product Already Exist! Use Another Name'})
    }

    const validation =  validationFunction(name, brand,rating, price, quantity, description,req.body.category,req.files);

    if(validation.status){
      const categorys = await category.findOne({ name: req.body.category });

      const update = {
        name: name,
        brand: brand,
        categoryId: categorys._id,
        rating: rating,
        price: price,
        quantity: quantity,
        description: description,
      };
  
     const productUpdate = await product.updateOne({ _id: id }, { $set: update });
    //  if(productUpdate.modifiedCount<=0){
    //   return res.json({msg:'No Changes Made!'})
    //  }
      res.json({status:true})
    }else{
      res.json({msg:validation})
    }


  } catch (error) {
    console.log(error.message);
  }
};

// Edite iamge
const verifyEditImage = async (req, res) => {
  try {
    const file = req.file;
    const { index, id } = req.query;
    const proImage = await product.findOne({_id:id}); 
    fs.unlink(imagePath+proImage.image[index],(err)=>{
      if(err){
        console.log(err.message);
      }
    });
    await product.updateOne(
      { _id: id },
      { $set: { ["image." + index]: file.filename } }
    );
    res.json({ status: true });
  } catch (error) {
    console.log(error.message);
  }
};

// deleteProduct
const verifyDeleteProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const proImage = await product.findOne({_id:id});
    proImage.image.forEach(element => {
      fs.unlink(imagePath+element,(err)=>{
        if(err){
          console.log(err.message);
        }
      });
    });
    const deleteProduct = await product.deleteOne({ _id: id });
    if (deleteProduct) {
      res.send({ deleteProduct });
    }
  } catch (error) {
    console.log(error.message);
  }
};

// Delete image
const deleteImages = async (req, res) => {
  try {
    const { i, id } = req.body;

    const findImage = await product.findOne({ _id: id });

    if (findImage.image.length === 1) {
      return res.json({ status: false });
    }

    fs.unlink(imagePath+findImage.image[i],(err)=>{
      if(err){
        console.log(err.message);
      }
    });

    const imageToRevmove = findImage.image[i];
    const data = await product.findByIdAndUpdate({ _id: id }, { $pull: { image: imageToRevmove } },{new:true});
    res.json({ status: true,length:data.image.length });
  } catch (error) {
    console.log(error.message);
  }
};

// add image
const addImages = async (req,res) => {
  try{
    const {id}=req.query;
    const file = req.file;
    const productImage = await product.findOne({_id:id});
    if(productImage.image.length>=4){
      return res.json({msg:'Maximum of 4 Images are allowed!'});
    }
    const data =  await product.findByIdAndUpdate({_id:id},{$push:{image:file.filename}},{new:true});
    res.json({status:true,length:data.image.length-1,filename:file.filename});
  }catch(error){
    console.log(error.message);
  }
};

// to get the search in products list
const getSearchData = async (req,res) => {
  try{
    const {searchValue,page}=req.query;
    let pageInt = parseInt(page);
    if(pageInt<=0){
      pageInt=1;
    }
    const limit = 10;
    const startIndex = (pageInt-1)*limit;
    const regexPattern = new RegExp(searchValue,'i');
    const products = await product.find({$or:[{name:regexPattern},{brand:regexPattern},{"categoryId.name":regexPattern}]}).populate('categoryId').skip(startIndex).limit(limit).sort({name: -1, brand: -1, "categoryId.name": -1});
    const allProducts = await product.find().populate('categoryId').sort({_id:-1}).skip(startIndex).limit(limit);
    const totalProductsCount = await product.find({$or:[{name:regexPattern},{brand:regexPattern},{"categoryId.name":regexPattern}]}).countDocuments();
    const AlltotalProductsCount = await product.countDocuments();
    const hasNextPage = searchValue ?  totalProductsCount > limit * pageInt : AlltotalProductsCount > limit * pageInt;
    res.json({products:searchValue?products:allProducts, nextPage:hasNextPage ,page:pageInt});
  }catch(error){
    console.log(error.message);
  }
}

module.exports = {
  loadProducts,
  loadAddProducts,
  verifyAddProducts,
  verifyDeleteProduct,
  loadEditProduct,
  verifyEditProduct,
  verifyEditImage,
  deleteImages,
  addImages,
  getSearchData,
};
