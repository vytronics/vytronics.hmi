Vytronics.HMI
=========

The 100% Free, Open-Source, SCADA/HMI Iniative.

Copyright 2014 Charles Weissman

See Installation and Evaluation section below for instructions on how to setup a free, cloud-based IDE and working SCADA system in just a few minutes.
[Click here for live demo!]

---

Vytronics.HMI aims to be the world's fastest growing and most popular Open-Source SCADA/HMI. It is the first and (at the time of initial publishing) the only system that supports all of the following capabilities:
- Use Javascript, the world's most popular programming language, for client and server side scripting to make the easy things easy and the hard things possible.
- Create a free, cloud-based, collaborative IDE and runtime in just a few minutes without installing anything on your personal computer. Imagine allowing your clients to participate in the design process instantly from anywhere in the world, anytime!
- Use the same project design in any deployment mode without modification for emedded local control panel, client-server SCADA, and even hosted on the web!
- True, multi-platform support from a $35 [Raspberry Pi] to a Windows or Linux based server cluster. Design for the application and leave deployment as an administrative exercise.
- Design a project using only a simple text editor or 3rd party tooling. You make the choice based on your project needs.
- Integrate seamlessly with git on github or your private repository for powerful version control.


Experimental Community Preview
----

This community preview (herein referred to as the "CP") is the first publishing milestone in the Vytronics.HMI development roadmap. The purpose of the CP is to make source code and development tools available to the public in the shortest time possibe in order to:
- Generate interest
- Allow developers, system integrators, users and other industry stakeholders to evaluate its merits and to consider for utilization in future projects.
- Give developers and system integrators a head start in the learning curve so they are ready for the first stable release.
- Get as much community involvement and feedback as possible to ensure the first stable release optimumly meets the expectation of stakeholders.

The CP is NOT intended to be a complete work and is not intended "as-is" to be used in production. Don't think however that the CP is just an academic exercise. This is a functioning product with a data simulator that can be deployed in just a few minutes on your own free personal cloud-based IDE. Visit [www.vytronics.com] for information on downloading and using the code.

Roadmap
----
- Community Preview (May 2014)
- Version 1.0.0 Stable Release (November 2014)


Technology Overview
-----------

Vytronics.HMI is powered by some amazing open-source programs and libraries to accomplish in remarkably few lines of code what traditionally takes hundreds and thousands. The technology also enables Vytronics.HMI to do things that are simply not possible or not practical in the available commercial products. The following summarizes the key technologies used in the system:

* [HTML5] and [SVG] - The standard markup languages for the web that enable true cross-platform, web-enabled HMI's without the need for plugins or apps.
* [Node.js] - A non-blocking server-side javascript interpretor for building real-time Internet and network applications. Node.js is built upon Google's V8 Javascript engine and is used by some of the largest websites in the world.
* [Express] - a minimal and flexible node.js web application framework, providing a robust set of features for building single and multi-page, and hybrid web applications.
* [Socket.io] - aims to make realtime apps possible in every browser and mobile device, blurring the differences between the different transport mechanisms. It's care-free realtime 100% in JavaScript. This is the key component that enables platform independent non-polling and real-time performance over the Internet.
* [Cloud9 IDE] - Cloud-based IDE and development runtime allowing collaborative design anywhere, anytime.

Installation and Evaluation
--------------

- Visit [Cloud9 IDE] and sign up for your own free cloud-based IDE.
- Click on "Create a New Workspace" and select the "Clone from URL" option.
- Paste the following URL into the form: https://github.com/vytronics/vytronics.project.git
- Important - Click on the "NodeJS" button and then press Create

This will create a new workspace named "vytronics.project". It will take several minutes for the IDE to create a virtual machine. The workspace will automatically open up when completed. If not then press the "Start Editing" button in your dashboard. There will be one root folder with the same name as the project. It contains a complete sample project. Dependent modules, which include the core vytronics.hmi module and other 3rd party open-sources, are not downloaded automatically. No worries, just follow the following instruction to download, install and configure them automatically using the Node Package Manager (npm).

Click on the "Terminal" tab at the bottom left of the workspace and type the following command in the terminal window. It will take several minutes to download files and install.
```sh
npm install  
```

Believe it or not you have just created a SCADA system in the cloud. Go ahead and run the application. Double click on the file "application.js" in the root directory. Make sure application.js is the active file in the editor. Then press the green arrow-shaped button in the top menu (the run button). If all goes well the button should turn to a square red box (stop button) and you should see the following messages in the output window (first and last lines shown):
```sh
Your code is running at 'https://vytronicshmi-c9-<your username>.c9.io'.
...
HMI server listening at 127.4.119.129:8080
```

Clicking on the link in the output window will open webpage showing the tags from the project.json file in a tabular format. The page will update in real-time to reflect the latest tag values. In the default workspace layout this will also open the page in the right side pane. Go ahead and open the link on your smart phone or in another browser window. All of the open pages should update at the same time with the same latest values.

You can also install [Node.js] on your personal computer, clone the vytronics.project repository, and then run "npm install". Run the project with the command "node application" and then open a webpage at localhost:8000. This assumes you have git installed.

Feeling adventurous? Modify files in the project folder to add your own HMI tags, SVG and html.


License
----

GNU AFFERO GENERAL PUBLIC LICENSE

(This file created online using Dillinger.io, the free cloud-enabled HTML5 Markdown editor http://dillinger.io/ )

[Raspberry Pi]:http:www.raspberrypi.org
[www.vytronics.com]:http://www.vytronics.com
[Node.js]:http://http://nodejs.org/
[Express]:http://expressjs.com/
[Socket.io]:http://ace.ajax.org
[Cloud9 IDE]:http://https://c9.io/
[HTML5]:http://www.w3.org/TR/html5/
[SVG]:http://www.w3.org/Graphics/SVG/
[Click here for live demo!]:http://demo-vytronics.rhcloud.com:8000/
