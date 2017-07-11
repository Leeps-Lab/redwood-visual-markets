var fs = require('fs');
var parse = require('csv-parse');

var form = [];

var createData = function(cols) {
  var data = {};

  for (var i = 0; i < cols.length; i++) {
    var ele = cols[i];

    if (isNaN(ele)) {
      data[ele] = '';
    }
  }
  data.Options = [];

  return data;
}

var parser = parse(function(err, rows) {
	var cols = rows[0];

  for (var i = 1; i < rows.length; i++) {
    var data = createData(cols);
    var row = rows[i];

    for (var j = 0; j < row.length; j++) {
      var ele = row[j];
      if (isNaN(cols[j])) {
        data[cols[j]] = ele;

      } else {
        if (ele) {
          data.Options.push({
            value: ele,
            show: true
          });
        }
      }
    }

    if (data.Value === 'Categorical' || data.Value === 'Boolean') {
      data.Options.splice(0, 0, {
        value: data.Question,
        show: false
      });
    }

    if (data['Display (Visible to Respondent)'] !== 'Yes' &&
        data['Display (Visible to Respondent)'] !== 'Yes (confirm with email)' &&
        data['Display (Visible to Respondent)'] !== 'Yes?' &&
        data['Display (Visible to Respondent)'] !== 'No' &&
        data['Display (Visible to Respondent)'] !== 'All') {
      var tmp = data['Display (Visible to Respondent)'];

      if (tmp.includes(' = ')) {
        tmp = tmp.split(' = ');
        if (!isNaN(tmp[1])) {
          for (var j = 0; j < form.length; j++) {
            if (form[j].Variable === tmp[0]) {
              tmp[1] = [form[j].Options[tmp[1]].value];
            }
          }
        } else if (tmp[1].includes('{') && tmp[1].includes('}')) {
          var values = [];
          tmp[1] = tmp[1].replace('{', '').replace('}', '').replace(/\s/g, '').split(',');

          for (var j = 0; j < form.length; j++) {
            if (form[j].Variable === tmp[0]) {
              for (var k = 0; k < tmp[1].length; k++) {
                values.push(form[j].Options[tmp[1][k]].value);
              }
              tmp[1] = values;
            }
          }
        } else if (tmp[1].includes('[') && tmp[1].includes(']')) {
          tmp[1] = tmp[1].replace('[', '').replace(']', '').replace(/\s/g, '').split(',');

          for (var j = 0; j < form.length; j++) {
            if (form[j].Variable === tmp[0]) {
              for (var k = 0; k < tmp[1].length; k++) {
                values.push(form[j].Options[tmp[1][k]].value);
              }
              tmp[1] = values;
            }
          }
        }

        data['Display (Visible to Respondent)'] = {
          field: tmp[0],
          value: tmp[1]
        };
      } else {
        // console.log(data['Display (Visible to Respondent)']);
      }
    } else {
      // console.log(data['Display (Visible to Respondent)']);
    }
    // console.log(data['Display (Visible to Respondent)']);
    // console.log(data.Options);

    form.push(data);
  }

  console.log(JSON.stringify(form));
});

fs.createReadStream(__dirname+'/rpmsFields.csv').pipe(parser);
