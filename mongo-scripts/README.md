## daily scripts

Some scripts present in this directory have the `daily-` prefix, this mean
they are executed daily and they operate on the previous day

## hourly scripts

guess what? they operate about the previous hour

# Common elements

`DAYSAGO` is an environment variable that might used to execute the script $var * 24 hours back in time. default is 1 (the day before)
`HOURSAGO` is an environment variable that might used to execute the script $hvar hours back in time, default is 1 (the hour before)

`HOURSAFTER` is an environment variable mutually exclusive with the two earlier, takes a number of hours after the fbtrex moment 0 ("2016-12-09")

# Numbered scripts

the script starting with a number, are incremental ad executed only during data migrations.
