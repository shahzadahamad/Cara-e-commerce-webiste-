const mongoose = require('mongoose');

const category = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    required: true
  },
  offer:{
    type:mongoose.Schema.ObjectId,
  }
});

module.exports = mongoose.model('category',category);
