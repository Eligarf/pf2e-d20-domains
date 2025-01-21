await User.updateDocuments([{
  _id: game.user.id,
  'flags.confirm-bias.-=sessions': true
}]);

ui.notifications.notify(`Reset Session Data`);
