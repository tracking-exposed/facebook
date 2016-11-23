
# Stress test

    DEBUG=* times=250 delay=1 source=/dev/shm/stressTest-122705.json,/dev/shm/stressTest-122645.json url='http://localhost:8001' operations/stressTest.js 

to generate the files, comment the 'return' in lib/events.js:26

```
25   /* return undefined means no error */
26   return undefined;
27     
28   /* special: to use operations/stressTest.js with valid 
31   ...

```

# Other files

not maintained with the ß
