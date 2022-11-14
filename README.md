# TetheredRing
A Tethered Ring is a dynamic structure that can cost-effectively support space launch facilities, transportation infrastructure, and a sizable human settlement at high altitudes. An altitude of 32 km and a population of 250,000 is shown to be achievable using circa 2017 science and technology.  The structure resembles a pipeline formed into a ring having a diameter similar to that of Earth’s moon. It stays aloft primarily by generating and properly combining inertial forces with tensile forces to offset the pull of gravity. The inertial forces are produced by the circular motion of magnetically levitated rings within the pipeline, and the tensile forces are generated by appropriately tethering the pipelines to the planet using stays made of strong, light-weight, industrial fiber.  The entire structure can be fabricated on Earth and neither its construction nor its deployment depends on a pre-existing space infrastructure or space-based industry. The deployed structure is resilient to catastrophic failure because its precision-guided fast moving components are: a) not exposed to seismic or climatic battering, and b) safely above and thus out of range of tacit civilizational threats, such attacks involving torpedoes or commandeered aircraft.  The tethered ring is an optimal “stepping stone” infrastructure for furnishing humanity with a safe, affordable, and sustainable means to escape Earth’s gravity, expand its civilization into space, and ultimately evolve into a multi-planetary species.  Check out the brief explanation and full whitepaper at: https://www.project-atlantis.com

# Getting started

**Install NodeJS & NPM**

https://nodejs.org/en/download/

_Note: NPM is now included with NodeJS_

You can verify installation and determine your installed version using the commands below

**Node** _(v19.0.1 tested)_
```
node -v
```
**NPM** _(9.1.1 tested)_
```
npm -v
```

# Setup
**Clone the repo**
```
git clone https://github.com/philipswan/TetheredRing.git
```
**Switch to the install directory**
```
cd TetheredRing
```
**Install required packages**

_Standard node modules installation_
```
npm install
```
**Sync development files**

_This is an additional required setup step in order for the model to be displayed correctly. This script is responsible for syncing the textures from the remote server to your local development environment._
```
npm run dev-sync
```
**Run the development server**

_Handled by [Vite](https://vitejs.dev/)_
```
npm run dev
```
**Navigate to the URL specified in the `run dev` output to view the model**

_**Note:** when working on the project, on occasion you may need to hard refresh the browser in order for the model to display properly. This is usually the command \<ctrl\> + \<shift\> + 'R'_

# Using the Model - Keyboard:

|Key|Function|
|---|---|
|`P`| Moves the point that you orbit around. It will place it just above the surface of the Earth, or on the transit tube, depending on which of these objects the sprite is hovering over when you press this key.|
|`O`| Moves the point that you orbit around back to the center of the Earth.|
|`R`/`L`| Slowly raise and lower the ring.|
|`U`/`D`| Increase and decrease the altitude of the camera.|
|`Z`/`X`| Slowly zoom in or out.|
|`Q`| Slowly orbit around the point set by `P` or `O`.|
|`W`| Instantly "warp" you over to a point much closer to the ring.|
