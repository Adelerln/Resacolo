$(document).ready(function(){
    getDepartsOfVille();
    $( "#dateDepart" ).change(function() {
        $('.prereservation').hide();
        $('.reservation').show();
        $('#villeDepart').find('option').not(':first').remove();
        $('#prixDep').text('');
        $('#btnReserver').attr('href','');
        $('.au-lieu-de').addClass('hidden');
        $('.au-lieu-de').addClass('d-none');
        var dataPromo = $(this).find(":selected").attr('data-promo');
        $('#dateBeforePromo').html(dataPromo);
        if($(this).val() == 0) {
            var dataPrix = $('#prixMin').val();
        }
        else
            var dataPrix = $(this).find(":selected").attr('data-prix');
        $('#prixDep').html(dataPrix);
        getDepartsOfDates($(this).find(":selected").attr('data-dtDb'), $(this).find(":selected").attr('data-dtFn'));

    });
    $( ".villeSelect" ).change(function() {
        $('#prixDep').text('');
        $('#btnReserver').attr('href','');
        $('.au-lieu-de').addClass('hidden');
        $('.au-lieu-de').addClass('d-none');
        //getDepartsOfVille(ville);
        if($(this).val() == 0) {
            $('#prixDep').text($('#prixMin').val());
            $('#btnReserver').attr('href','');
            $('.prixBlock').show();
            $('.notDispo').hide();
        }
        else
        {
            var tempPrix = $(this).find(":selected").attr('data-prix');
            var dataPrix = parseFloat(tempPrix).toFixed(2);
            if(!(dataPrix > 0))
                dataPrix= "COMPLET";
            if($('.block-new-sanspromo').length)
                var dataPrixSansPromo = parseFloat($(this).find(":selected").attr('data-prixbarre')).toFixed(2);
            else
                var dataPrixSansPromo = parseFloat($(this).find(":selected").attr('data-prixsp')).toFixed(2);
           // au-lieu-de
            if(dataPrix) {
                $('#prixDep').text(dataPrix);
                if((dataPrixSansPromo != dataPrix)&&(dataPrix != "COMPLET")) {
                    $('#prixSansPromo').text(dataPrixSansPromo);
                    $('.au-lieu-de').removeClass('hidden');
                    $('.au-lieu-de').removeClass('d-none');
                }
                else {
                    $('#prixSansPromo').text('');
                    $('.au-lieu-de').addClass('hidden');
                    $('.au-lieu-de').addClass('d-none');
                }
                $('.notDispo').hide();
                $('.prixBlock').show();
            }
            else {
                $('.notDispo').show();
                $('.prixBlock').hide();
            }
            if($(this).find(":selected").attr('data-prereserver') == '1')
            {
                $('.prereservation').show();
                $('.notDispo').hide();
                $('.reservation').hide();
            }
            else {
                $('.prereservation').hide();
                if(dataPrix == "COMPLET") {
                    $('#btnReserver').attr('href', '');
                    $('.reservation').hide();
                    $('.currency').hide();
                }
                else {
                    $('.currency').show();
                    $('.reservation').show();
                    $('#btnReserver').attr('href', $(this).find(":selected").attr('data-url'));
                }
                // $('.reservation').show();
                // $('#btnReserver').attr('href', $(this).find(":selected").attr('data-url'));
            }
        }
    });

});

function getDepartId(v,d,f)
{
    $.ajax({
        url: $('.urlDepart').val(),
        type: "GET",
        dataType: "json",
        data: { sejour_id: $("#sejourId").val(), ville : v, dateDb : d, dateFn : f},
    }).done(function(data) {
        if(data.length == 1){
            $.each(data, function(v) {
                var dep = data[0]['id'];
                var prixBase = data[0]['prix'];
                $('.prixBlock').show();
                $('#prixDep').text(prix);
                $('.notDispo').hide();
                $('#btnReserver').attr('href',data[0]['url']);
            });
        }
        else {
            $('.prixBlock').hide();
            $('#prixDep').text('');
            $('.notDispo').show();
        }
    }).fail(function() {

    });
}

function getDepartsOfVille(v="")
{

    $.ajax({
        url: $('.urlDepart').val(),
        type: "GET",
        dataType: "json",
        data: { sejour_id: $("#sejourId").val(), ville : v},
    }).done(function(data) {
        var tempArray = [];
        var tempMinPrixArray = [];
        if(data.length > 0){
            $.each(data, function(k,val) {
                var s = $(val['prix']).text();
                var regMatch = s.match(/[+-]?\d+(\.\d+)?/gm);
                if(regMatch)
                    var p = regMatch[(regMatch.length)-1];
                else
                    var p ="";

                if(p != "") {
                    if (!(tempMinPrixArray[val["date"]])) {
                        tempMinPrixArray[val["date"]] = parseFloat(p);
                    } else {
                        if (tempMinPrixArray[val["date"]] > parseFloat(p))
                            tempMinPrixArray[val["date"]] = parseFloat(p);
                    }
                }
            });
            $.each(data, function(k,val) {
                if (($.inArray(val["date"], tempArray) == -1)) {
                    var tempMin = parseFloat(tempMinPrixArray[val["date"]]);
                    if(tempMin> 0) {
                        var t=tempMinPrixArray[val["date"]].toFixed(2);
                    }

                    else {
                        var t = "COMPLET";
                    }
                    $('#dateDepart').append('<option data-prix="' + t + '" data-promo="' + val["datePromo"] + '" data-dtdb="' + val["dtDb"] + '" data-dtFn="' + val['dtFn'] + '">' + val["date"] + '</option>');
                    tempArray.push(val["date"]);
                }
            });

        }

    }).fail(function() {

    });
}
function getDepartsOfDates(db, df)
{
    $.ajax({
        url: $('.urlDepart').val(),
        type: "GET",
        dataType: "json",
        data: { sejour_id: $("#sejourId").val(), dateDb: db, dateFn: df},
    }).done(function(data) {
        if(data.length > 0){
            $.each(data, function(k,v) {
                var s = $(v['prix']).text();
                var regMatch = s.match(/[+-]?\d+(\.\d+)?/gm);
                if(regMatch)
                    var p = regMatch[(regMatch.length)-1];
                else
                    var p ="COMPLET";

                //  var prix = s.substring(0, s.indexOf('€'));
                $('#villeDepart').append('<option data-prereserver="'+v["prereservation"]+'" data-url="'+v["url"]+'" data-prix="'+p+'" data-promo="'+v["datePromo"]+'" data-prixsp ="'+v["prixSansRemise"]+'" data-nomville="'+v["nomVille"]+'" data-prixBarre="'+v["prixBarre"]+'">'+v["ville"]+'</option>');

            });
        }
    }).fail(function() {

    });
}
