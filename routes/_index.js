var express = require('express');
var router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const redis = require('redis');
const client = redis.createClient();
var BarrierLogs = require('../models/BarrierLogs');
var User = require('../models/User');
const authenticateToken = require("../middlewares/auth");
const { default: axios } = require('axios');
require('dotenv').config();
const snmp = require('net-snmp');
//API_URL='http://192.168.0.151/relay?state=on'
API_URL='http://localhost:3000/relay?state=on'
// const app = express();


client.on('error', function (err) {
  console.log('Error ' + err);
});


let lastPlateNumber = '';
let carDump = [
  {
    'plateNumber': 'KAA 001A',
    'plateColor': 'Color',
    'deviceID': 'deviceID_01',
    'direction': 'GateIN',
  },

];


const BarrierTrigger = async () => {
  try {
    const response = await axios.get(API_URL);
    return response.status === 200 ? 200 : 500;
  } catch (err) {
    console.error(err);
    return 500;
  }
}

router.get('/relay', async function (req, res){
  const state = req.query.state;

  if (state === 'on') {
    //relay('on');
    return res.status(200).send("Relay turned on successfully.");
  } else {
    return res.status(500).send("Invalid state provided.");
  }
});


/* GET home page. */
router.get('/plateInfo', authenticateToken, function (req, res) {
  // Retrieve data from Redis
  const plate = carDump;
  return res.status(200).json(plate);

});


router.post('/barrierLogs', authenticateToken, async function (req, res, next) {
  const data = req.body;
  const theDirection = data.direction;
  const loggedIN = req.user.id;

  try {
    // Find in carDump the record whose carDump.PlateNumber == data.plateNumber.
    //const carRecord = carDump.find(car => car.PlateNumber === data.plateNumber);
    const carRecord = carDump.find(car => car.plateNumber === data.plateNumber);

    if (!carRecord) {
      return res.status(404).json({ message: "Car record not found." });
    }

    const loG = await BarrierLogs.create({
      plateNumber: carRecord.plateNumber,
      plateColor: carRecord.plateColor,
      deviceID: carRecord.deviceID,
      direction: theDirection,
      createdby: loggedIN,
    });

    const request = BarrierTrigger();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// router.post('/barrierLogs', authenticateToken, async function (req, res, next) {
//   const data = req.body;
//   const theDirection = data.direction;
//   //find in carDump the record whose carDump.PlateNumber == data.plateNumber.
//   //Use the record details to feed barrierLogs.Create below.

//   try {
//     const loG = BarrierLogs.create({
//       plateNumber: data.plateNumber,
//       plateColor: data.plateColor,
//       deviceID: data.deviceID,
//       direction: theDirection,
//       createdby: data.user,
//     });
//     return res.status(200).json({ status: 200, loG });
//   } catch (err) {
//     return res.status(500).json({ message: err.message });
//   }
// }
// );

//get logs
const snmpOptions = {
    version: snmp.Version2c, // SNMP version (2c in this example)
    retries: 3, // Number of retries
    timeout: 5000, // Timeout in milliseconds
    port: 161, // SNMP port (161 by default)
    trapPort: 162, // Trap port (162 by default)
    community: 'public', // Read community string
    writeCommunity: 'private', // Write community string
    trapReceiver: '192.168.0.150', // Trap receiver address
    trapEnabled: true // Enable/disable trap reception
};

router.get('/snmp', (req, res) => {
    // Set the IP address of the SNMP-enabled device
    const deviceIp = '192.168.0.29';

    // Set the OID (Object Identifier) of the SNMP variable you want to query
    const oid = '1.3.6.1.2.1.1.1.0';

    // Create an SNMP session with the specified configuration
    const session = snmp.createSession(deviceIp, 'public', snmpOptions);

    // Make an SNMP GET request
    session.get([oid], (err, varbinds) => {
        if (err) {
            console.error('SNMP GET Error:', err);
            res.status(500).send('Error querying SNMP device');
        } else {
            // Extract the value from the response
            const value = varbinds[0].value.toString();

            // Send the value as the response
            console.log(`Value of OID ${oid}: ${value}`);
            res.send(`Value of OID ${oid}: ${value}`);
        }
        // Close the SNMP session
        session.close();
    });
});


// Define an SNMP manager route
// router.get('/snmp', (req, res) => {
//     // Set the IP address of the SNMP-enabled device
//    const deviceIp = '192.168.0.29'; // Change this to the IP address of your SNMP-enabled device

//     // Set the OID (Object Identifier) of the SNMP variable you want to query
//     const oid = '1.3.6.1.2.1.1.1.0'; // This is an example OID, you can change it to match your requirement

//     // Create an SNMP session
//     const session = snmp.createSession(deviceIp, 'public');

//     // Make an SNMP GET request
//     session.get([oid], (err, varbinds) => {
//         if (err) {
//             console.error('SNMP GET Error:', err);
//             res.status(500).send('Error querying SNMP device');
//         } else {
//             // Extract the parameters from the response
//             const varbind = varbinds[0]; // Assuming only one OID is queried
//             const oid = varbind.oid;
//             const type = snmp.ObjectType[varbind.type].toUpperCase(); // Convert type to human-readable format
//             const value = varbind.value.toString(); // Convert value to string
//             const valueHex = varbind.valueHex; // Get value in hexadecimal format
//             const object = varbind.object;

//             // Send the response with all parameters
//             res.json({ oid, type, value, valueHex, object });
//         }

//         // Close the SNMP session
//         session.close();
//     });
// });



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



router.post('/NotificationInfo/KeepAlive', async function (req, res, next) {
  const data = req.body;
  console.log("req data", data);
  return res.status(200).json("ok");
}
);



router.post('/ANotificationInfo/DeviceInfo', async function (req, res, next) {
  const data = req.body;
  console.log("req data", data);
  return res.status(200).json("ok");
}
);

router.post('/BNotificationInfo/DeviceInfo', async function (req, res, next) {
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
    return res.status(500).json({ message: err.message });
  }
}
);



router.post('/BNotificationInfo/TollgateInfo', async function (req, res, next) {
  const data = req.body;




  console.log("Plate Data", data);

  const plateNumber = data.Picture.Plate.PlateNumber;
  const plateColor = data.Picture.Plate.PlateColor;
  const deviceID = data.Picture.SnapInfo.DeviceID;
  const direction = data.Picture.SnapInfo.Direction;
	
   
  // Adding check to ignore plate numbers less than 7 characters
  if (plateNumber.length >= 5) {
    if (plateNumber !== lastPlateNumber) { 
      // Store data in carDump array
      carDump.push({
        'plateNumber': plateNumber,
        'plateColor': plateColor,
        'deviceID': deviceID,
        'direction': direction
      });
      // Update lastPlateNumber

	
      lastPlateNumber = plateNumber;
    }  else {
      console.log("Plate Exists");
    }
  

    // Logging plate number and color to the console
    console.log("Plate Number:", plateNumber);
    console.log("Plate Color:", plateColor);
    console.log("Device ID:", deviceID);
    console.log("Direction:", direction);

    console.log("carDump", carDump);

  } else {
    console.log("Plate number ignored due to length less than 6 characters.");
  } 

  return res.status(200).json({ status: "ok" });
});


router.post('/ANotificationInfo/TollgateInfo', async function (req, res, next) {
  const data = req.body;
   console.log("Plate Data", data);
  const plateNumber = data.Picture.Plate.PlateNumber;
  const plateColor = data.Picture.Plate.PlateColor;
  const deviceID = data.Picture.SnapInfo.DeviceID;
  const direction = data.Picture.SnapInfo.Direction;
   
  // Adding check to ignore plate numbers less than 7 characters
  // if (plateNumber.length >= 5) {
  //   if (plateNumber !== lastPlateNumber) { 
  //     // Store data in carDump array
      carDump.push({
        'plateNumber': plateNumber,
        'plateColor': plateColor,
        'deviceID': deviceID,
        'direction': direction
      });
      // Update lastPlateNumber

	
    //   lastPlateNumber = plateNumber;
    // } else {
    //   console.log("Plate Exists");
    // }
	


    // Logging plate number and color to the console
    console.log("Plate Number:", plateNumber);
    console.log("Plate Color:", plateColor);
    console.log("Device ID:", deviceID);
    console.log("Direction:", direction);

    console.log("carDump", carDump);
 
  // } else {
  //   console.log("Plate number ignored due to length less than 6 characters.");
  // }

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
