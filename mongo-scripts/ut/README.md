# unit testing fresh data fetcher

These scripts run only on the testing server, where we import timelines
only from developers profile and/or profiles under our control. The goal of
the script is permitting to developers to get fresh timelines to make the unitTest run on them.

## last-15-timelines.sh

This is executed on the testing server, where mongodb has data. It created a directory in `/tmp/unit-test-l15` containing 15 subdirectory, for example:

```
20136 ۞  ~/Dev/facebook/mongo-scripts/ut  ༚2༚ ls -l /tmp/unit-test-l15/
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 39e2849baa00c1911144444441115be70abe943f
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 3b0cc64a99f2f871114444444111f44d0fd55f7b
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 61207aa79d7479e1114444444111f752fadc7328
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 63469e9b676e10611144444441118d3c4e94a706
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 69f9401f007663b1114444444111471c7d68b47e
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 96e5399a9070dfa11144444441110b2acf83e5d7
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 994bb27bfe4fcec11144444441115b2e02013dfa
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 a60a488b3c185301114444444111a761c5182ee5
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 ac4ea0329e816a91114444444111d87bbd4b4a9d
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 bd9348c76f1a8d411144444441119423120c68d9
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 cf6b6c1a2f4dd4f11144444441117b21301d6191
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 e31615fa9eeec62111444444411185777432b19b
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 edcef6a87cb25c111144444441119d6fa3af2515
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 f8c22941b8c6230111444444411175640eab60a3
drwxr-xr-x 3 oo oo 4096 fev 27 11:26 fe1f7f1656831c91114444444111dd0ddfad7797
-rw-r--r-- 1 oo oo  699 fev 27 11:26 last-15.log
-rw-r--r-- 1 oo oo  168 fev 27 11:26 last-15-timelines.js
20137 ۞  ~/Dev/facebook/mongo-scripts/ut  ༚2༚ 
```

## import-timelines.sh

it works for developers with their ssh key installed in `testing.tracking.exposed`, it execute the command above and download the timelines. Save them in a database named `fbtestsource`, which is the one configured to be used by the test, because it is specify in `config/unitTest.json`.
