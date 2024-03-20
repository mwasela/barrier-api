var express = require('express');
var router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const redis = require('redis');
const client = redis.createClient();
var BarrierLogs = require('../models/BarrierLogs');
var User = require('../models/User');
const authenticateToken = require("../middlewares/auth");
// const app = express();


client.on('error', function (err) {
  console.log('Error ' + err);
});


let lastPlateNumber = '';
let carDump = [
  {
  'plateNumber': 'plateNumber_01',
  'plateColor': 'plateColor_01',
  'deviceID': 'deviceID_01',
  'direction': 'direction_01',
  },
  {
    'plateNumber': 'plateNumber_02',
    'plateColor': 'plateColor_02',
    'deviceID': 'deviceID_02',
    'direction': 'direction_02',
  }
  ];

/* GET home page. */
router.get('/plateInfo',authenticateToken, function (req, res) {
  // Retrieve data from Redis
  const plate = carDump;
  return res.status(200).json(plate);

});




router.post('/barrierLogs', authenticateToken, async function (req, res, next) {
  const data = req.body;
  try {
    const loG = BarrierLogs.create({
      plateNumber: data.plateNumber,
      plateColor: data.plateColor,
      deviceID: data.deviceID,
      direction: data.theDirection,
      createdby: data.user,
    });
    return res.status(200).json({ status: 200, loG });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
);

//get logs


router.get('/barrierLogs', authenticateToken, async function (req, res, next) {

  // const page = parseInt(req.query.page) || 1;
  // const pageSize = req.query.limit;
  // const offset = (page - 1) * pageSize;

  try {
    const logs = await BarrierLogs.findAll({
      include: { model: User, attributes: { exclude: ['blk_users_password'] } },
      // limit: pageSize, // Corrected the LIMIT to limit
      // offset: offset
    });
    return res.json(logs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});



router.post('/NotificationInfo/KeepAlive', authenticateToken, async function (req, res, next) {
  const data = req.body;
  console.log("req data", data);
  return res.status(200).json("ok");
}
);


router.put('/plate', authenticateToken, async (req, res) => {

  const { _plate, _id } = req.body;

  console.log(req.body);

  try {
      const unit = await BarrierLogs.update({

          plateNumber: _plate
          
      }, {
          where: {
              id: _id
          }
      });

      return res.status(201).json({ message: 'Record updated successfully' });
  } catch (err) {
     return  res.status(500).json({ message: err.message });
  }
}
);


router.post('/NotificationInfo/TollgateInfo', authenticateToken, async function (req, res, next) {
  const data = req.body;
  //console.log("req data", data);
  const plateNumber = data.Picture.Plate.PlateNumber;
  const plateColor = data.Picture.Plate.PlateColor;
  const deviceID = data.Picture.SnapInfo.DeviceID;
  const direction = data.Picture.SnapInfo.Direction;

  if (plateNumber !== lastPlateNumber) {
    // Store data in carDump array
    
    carDump.push({
      'plateNumber': plateNumber,
      'plateColor': plateColor,
      'deviceID': deviceID,
      'direction': direction
    });

    ///console.log("sawa");

    // Update lastPlateNumber
    lastPlateNumber = plateNumber;
  }

  // Logging plate number and color to the console
  console.log("Plate Number:", plateNumber);
  console.log("Plate Color:", plateColor);
  console.log("Device ID:", deviceID);
  console.log("Direction:", direction);

  console.log("carDump", carDump);

  return res.status(200).json({ status: "ok" });
});



// router.post('/NotificationInfo/TollgateInfo', function(req, res, next) {
//   const data = req.body;
//   //console.log("req data", data);
//   const plateNumber = data.Picture.Plate.PlateNumber;
//   const plateColor = data.Picture.Plate.PlateColor;
//   const deviceID = data.Picture.SnapInfo.DeviceID;
//   const direction = data.Picture.SnapInfo.Direction;


//   if (plateNumber !== lastPlateNumber) {
//     // Store data in Redis
//     // client.hmset('plate_info', {
//     //   'plateNumber': plateNumber,
//     //   'plateColor': plateColor,
//     //   'deviceID': deviceID,
//     //   'direction': direction
//     // });
//     carDump = [];

//     carDump.push{ 'plate_info',{
//       'plateNumber': plateNumber,
//       'plateColor': plateColor,
//       'deviceID': deviceID,
//       'direction': direction
//      }
//     }

//     console.log("sawa");

//     // Update lastPlateNumber
//     lastPlateNumber = plateNumber;  
// }

// // Logging plate number and color to the console
// console.log("Plate Number:", plateNumber);
// console.log("Plate Color:", plateColor);
// console.log("Device ID:", deviceID);
// console.log("Direction:", direction);

// return res.status(200).json({status: "ok"});

// });

module.exports = router;
