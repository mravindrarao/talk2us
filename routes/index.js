
/*
 * GET home page.
 */

exports.index = function(req, res){
  if (req.user) {
      res.render('index', { title: 'Talk2Us', user: req.user.username });
  } else {
      res.redirect('/login');
  }
};
