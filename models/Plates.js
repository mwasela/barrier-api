//import sequelize
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Plates = sequelize.define('blk_plates', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    blk_plates: {
        type: DataTypes.STRING
    },
      blk_time: {
        type: DataTypes.STRING
    },
     blk_device: {
        type: DataTypes.STRING
    },

}, {
    timestamps: false
});

sequelize
  .sync({
    //force: true
  })
  .then(() => {
    console.log("Models synced with the database");
  })
  .catch((error) => {
    console.error("Error syncing models:", error);
  });

  module.exports = Plates;