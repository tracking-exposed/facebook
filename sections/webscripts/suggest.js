
var sk = {
  'interpretation': {
    'info': 'If you have an interpretation on the promotion or penaisation facebook applied to you, feel free to share with us',
    'questions': [
      { 'type': 'textarea', 'name': 'the only', 'defaultext': null }
    ]
  },
  'links': {
    'info': "I'm looking mostly for article written in non-English language, to provide a certain bibliography along with localisation",
    'questions': [
      { 'type': 'text', 'name': 'language', 'defaultext': null },
      { 'type': 'textarea', 'name': 'description', 'defaultext': 'a sentence on what is about ...' },
      { 'type': 'text', 'name': 'link', 'defaultext': null }
    ]
  },
  'declination': {
    'info': "TODO",
    'questions': [
      { 'type': 'text', 'name': 'country', 'defaultext': 'in which country can be used?'},
      { 'type': 'text', 'name': 'contact', 'defaultext': 'your contact'},
      { 'type': 'textarea', 'name': 'description', 'defaultext': 'description'},
      { 'type': 'text', 'name': 'external', 'defaultext': 'an external link'}
    ]
  },
  'groups': {
    'info': "Research Groups",
    'questions': [
      { 'type': 'text', 'name': 'contact', 'defaultext': 'an email'},
      { 'type': 'textarea', 'name': 'idea', 'defaultext': 'your idea'}
    ]
  }
};

var compileInfo = function(infoString) {
    return '<h2>' + infoString + '</h2>';
};

var compileQuestion = function(questionList) {
    return _.reduce(questionList, function(memo, qst) {
        memo = _.concat(memo, ["<p>", qst.name, "</p>"]);
        memo = _.concat(memo, '<input type="text" value="');
        memo = _.concat(memo, qst.defaultext);
        memo = _.concat(memo, '" class="meaningful" name="');
        memo = _.concat(memo, qst.name);
        memo = _.concat(memo, '" />');
        return memo;
    }, []).join("");
};

/* TODO find a nice way to manage this html injection */
var suggestion = function(identifier) {
    var info = compileInfo(sk[identifier].info);
    var questions = compileQuestion(sk[identifier].questions);
    var submit = "<button onclick=flushMeaningful();>Send!</button>"
    var sdiv = '<div class="suggestion modal">' + 
              info + 
              questions + 
              submit +
              '</div>';
    var target = document.getElementsByTagName("body")[0];
    var child = document.createElement('span');
    child.innerHTML = sdiv;
    target.appendChild(child);
};

var flushMeaningful = function() {
    console.log("send the values and");
    console.log("closed all the .suggestion elements");
}


// Get the modal
var modal = document.getElementById('myModal');

// Get the button that opens the modal
var btn = document.getElementById("myBtn");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks on the button, open the modal
btn.onclick = function() {
  modal.style.display = "block";
}

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
  modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};
