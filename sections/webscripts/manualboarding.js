function s() {

    var pk = document.getElementById('publickey').value;
    var sid = document.getElementById('supporterid').value;
    var pwd = document.getElementById('pwd').value;

    console.log(pk, sid, pwd);

    $.ajax({
        type: "POST",
        url: '/api/v1/manualboarding',
        data: {
            userId: sid,
            publicKey: pk,
            password: pwd
        }
    });
};
