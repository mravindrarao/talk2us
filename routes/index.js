
/*
 * GET home page.
 */

exports.index = function(req, res){
  if (req.user)  {
      res.shared.user = req.user;
  }
  res.render('index-foundation');
/*
  if (req.user) {
      res.shared.user = req.user;
      res.render('index', { title: 'Talk2Us', user: req.user.userid, role: req.user.role });
  } else {
      res.redirect('/login');
  }*/
};
