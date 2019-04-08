#node-red-contrib-loadbalancer


[Node-Red][1] node to [load balance][2].

Basically spreads input messages to flows based on:
*   round robin - next in list
*   random - randomly across out paths

This allows incoming messages to be passed to servers that may be other noder red instances.


##To be done
* resource based even load selection
* resource based fold selection

#Install

Run the following command in the root directory of your Node-RED install

    npm install node-red-contrib-loadbalancer


Test/example flow in  test/testflow.json


#Author
  
[Peter Prib][3] 

[id]: url "title"

[1]: http://nodered.org "node-red home page"

[2]: https://www.npmjs.com/package/node-red-contrib-loadbalancer "source code"

[3]: https://github.com/peterprib "base github"
