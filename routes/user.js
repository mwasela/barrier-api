var express = require('express');
var router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { secretKey } = require('../config');
const authenticateToken = require('../middlewares/auth');



//return current user
router.get('/current', authenticateToken, async (req, res) => {
  const Userlogged = req.user;
  console.log("user", User);
  try {
    const user_ = await User.findOne({
      where: {
        blk_users_id: Userlogged.id
      },
      attributes: {
        exclude: ['blk_users_password']
      }
    });

    return res.status(200).json({ user_ });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

  


router.post('/register', async (req, res) => {
  const { fname, surname, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await User.create({
      blk_users_fname: fname,
      blk_users_surname: surname,
      blk_users_email: email,
      blk_users_password: hashedPassword,
      blk_users_status: 1
    });

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

);


router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({
      where: {
        blk_users_email: email
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.blk_users_password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.blk_users_id }, secretKey, { expiresIn: '12h' });

    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ message: "Login Failed" });
  }
}
);


router.get('/user', authenticateToken, async (req, res) => {
  const { id } = req.user.id;

  try {
    const user = await User.findOne({
      where: {
        blk_users_id: id
      },
      attributes: {
        exclude: ['blk_users_password']
      }
    });

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

);

module.exports = router;  



