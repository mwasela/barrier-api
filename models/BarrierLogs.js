//import sequelize
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const BarrierLogs = sequelize.define('blk_barrier_logs', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    plateNumber: {
        type: DataTypes.STRING
    },
    plateColor: {
        type: DataTypes.STRING
    },
    deviceID: {
        type: DataTypes.STRING
    },
    direction: {
        type: DataTypes.INTEGER
    },
    comment: {
        type: DataTypes.STRING
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    createdby: {
        type: DataTypes.INTEGER,
    }
}, {
    timestamps: false
});

BarrierLogs.belongsTo(User, {
    foreignKey: 'createdby'
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

  module.exports = BarrierLogs;