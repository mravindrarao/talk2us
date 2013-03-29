
/*
 * GET home page.
 */

exports.index = function(req, res){
  if (req.user) {
      res.render('index', { title: 'Talk2Us', user: req.user.userid });
  } else {
      res.redirect('/login');
  }
};
