\# Task: move the customer site into customer/ (without the menu part)



Source: \_source/ (a copy of the customer site build).

Target: customer/ inside this project. customer/index.html does not exist yet.



\## Steps



1\. Create these folders if missing:

&#x20;  customer/css, customer/js/pages, customer/js/utils, customer/js/mock,

&#x20;  customer/assets/images/background, customer/assets/images/gallery



2\. Copy:

&#x20;  - \_source/index.html                  -> customer/index.html

&#x20;  - \_source/css/ambient.css             -> customer/css/

&#x20;  - \_source/css/hero.css                -> customer/css/

&#x20;  - \_source/css/sections.css            -> customer/css/

&#x20;  - \_source/js/hero.js                  -> customer/js/pages/

&#x20;  - \_source/js/sections.js              -> customer/js/pages/

&#x20;  - \_source/js/ambient.js               -> customer/js/utils/

&#x20;  - \_source/js/content.js               -> customer/js/mock/

&#x20;  - \_source/assets/images/background/\*  -> customer/assets/images/background/

&#x20;  - \_source/assets/images/gallery/\*     -> customer/assets/images/gallery/ (if any exist)



&#x20;  Do NOT copy: css/menu.css, js/menu.js, js/menu-data.js,

&#x20;  assets/images/textures/leather.png.



3\. Edit customer/index.html:

&#x20;  a) Delete this line from <head>:

&#x20;     <link rel="stylesheet" href="css/menu.css">

&#x20;  b) Delete the whole menu section, from the line

&#x20;     <!-- 3. MENU: categories with the sparkle transition -->

&#x20;     through its closing </section> tag (the section with id="menu").

&#x20;  c) In the top bar, delete this list item:

&#x20;     <li><a href="#menu">Menu</a></li>

&#x20;  d) Replace the script tags at the bottom of <body> with exactly these four lines:

&#x20;     <script src="js/mock/content.js"></script>

&#x20;     <script src="js/pages/hero.js"></script>

&#x20;     <script src="js/utils/ambient.js"></script>

&#x20;     <script src="js/pages/sections.js"></script>

&#x20;  (menu.js is intentionally left out.)



4\. Edit customer/js/pages/hero.js: change

&#x20;     location.href = 'admin/login.html';

&#x20;  to

&#x20;     location.href = '../Admin%20Panel/admin/login.html';



\## Safety rules



\- Before writing any file, check whether the destination already exists.

&#x20; If a file with the same name exists and is NOT one of the files named above,

&#x20; STOP and ask me. Do not overwrite it.

\- Never touch: "Admin Panel/", root js/api/, root js/mock/, root config.js,

&#x20; and these existing files in customer/: config.js, supabaseClient.js,

&#x20; js/api/ (any files), js/mock/api.js, and any existing file in js/pages/

&#x20; or js/utils/ that is not listed above.

\- Do not delete anything. Root leftovers from earlier work must only be listed.



\## Report



When finished, list:

\- every file created or changed,

\- every root leftover from our earlier work (for me to delete by hand),

\- anything you skipped and why.

