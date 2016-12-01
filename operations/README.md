
# Stress test

    DEBUG=* times=250 delay=1 source=/dev/shm/stressTest-122705.json,/dev/shm/stressTest-122645.json url='http://localhost:8001' operations/stressTest.js 

to generate the files, look for the string stressTest in lib/events.js


**REMIND**: change DB before do the stress, HTMLs content duplication can still cause inconsistencies  

# Other files

not maintained with the ß
