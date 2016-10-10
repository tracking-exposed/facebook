/*
 *  not used externally, only internally, or maybe for some kind of 
 *  new stat..
 *
    var url = '/post/top/2';
    return d3.json(url, function(something) {
        console.log(something);
        return "10150264415230896";
    });
*/

var displayRealityGraph = function(postId, containerId) {
    console.log("displayRealityGraph of postId " + postId);
    if(!postId || postId === "0") return;
    var url = '/post/reality/2/' + postId;
    d3.json(url, function(something) {
        console.log(something);
    });
};

var getPostId = function(sourceMaybe) {
    if(sourceMaybe === null) {
        console.log(String(document.location));
        var postId = parseInt( (String(document.location))
                                .replace(/.*realitymeter\//, ''));
    } else {
        var writtenv = document.getElementsByClassName(sourceMaybe);
        console.log(writtenv);
        var postId = parseInt("3323");
    }
    if(postId === NaN)
        return null;
    return postId;
}

