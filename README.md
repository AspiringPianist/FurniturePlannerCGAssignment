# Furniture Layout Planner

A small WebGL furniture planner for CSE606 - Computer Graphics.

The project uses vanilla JavaScript, WebGL, HTML/CSS and gl-matrix. It does not use Three.js or another high-level 3D engine.

## Start here

Open [index.html](index.html) in a browser.

This README is the only project documentation file. There is no `docs` folder anymore, so there should be no confusion about which notes to read.

The project documentation is organised in the [docs](docs/README.md) folder.

## Main files

- [index.html](index.html): canvas, HTML controls and GLSL shaders
- [main.js](main.js): WebGL, geometry, matrices, interaction and saving
- [style.css](style.css): right hand control panel and room labels
- [gl-matrix-min.js](gl-matrix-min.js): matrix maths library

This `README.md` is the single documentation file for the project.

## Sources used

These are the actual learning pages used for the WebGL ideas in this project. The project uses the ideas, not copied project code.

### WebGL Fundamentals

- [WebGL Fundamentals](https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html) - canvas, shaders, buffers and the basic WebGL setup
- [How WebGL works](https://webglfundamentals.org/webgl/lessons/webgl-how-it-works.html) - buffers, attributes, `vertexAttribPointer` and the GPU pipeline
- [Shaders and GLSL](https://webglfundamentals.org/webgl/lessons/webgl-shaders-and-glsl.html) - vertex and fragment shader ideas
- [2D Translation](https://webglfundamentals.org/webgl/lessons/webgl-2d-translation.html) - moving geometry and sending transform values
- [2D Rotation](https://webglfundamentals.org/webgl/lessons/webgl-2d-rotation.html) - sine, cosine and rotating geometry
- [2D Scale](https://webglfundamentals.org/webgl/lessons/webgl-2d-scale.html) - scaling geometry
- [2D Matrices](https://webglfundamentals.org/webgl/lessons/webgl-2d-matrices.html) - combining translation, rotation and scale in a matrix
- [Picking](https://webglfundamentals.org/webgl/lessons/webgl-picking.html) - ideas related to selecting objects
- [Points, Lines and Triangles](https://webglfundamentals.org/webgl/lessons/webgl-points-lines-triangles.html) - primitive drawing modes
- [Resizing the Canvas](https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html) - displayed canvas size and rendering size

### LearnOpenGL

- [Hello Triangle](https://learnopengl.com/Getting-started/Hello-Triangle) - vertex input, buffers, shaders and draw calls
- [Transformations](https://learnopengl.com/Getting-started/Transformations) - matrix transformations and why order matters
- [Coordinate Systems](https://learnopengl.com/Getting-started/Coordinate-Systems) - local, world, clip and screen coordinates
- [OpenGL](https://learnopengl.com/Getting-started/OpenGL) - general OpenGL/WebGL background

These links are also used throughout the assignment explanations in this README.

## What the project does

The planner draws a simple ground-floor layout with:

- kitchen and dining at the top-left
- bathroom at the top-right
- living area at the bottom-left
- bedroom at the bottom-right
- entry hall near the middle
- pre-rendered doorway geometry

The required furniture uses primitive WebGL geometry:

- bed: mattress, two pillows and blanket
- sofa: seat, back and two arm rests
- dining set: table and four chairs
- circular coffee table
- L-shaped sectional made from two rectangles
- doorway line and swing arc

Bathroom fixtures, kitchen appliances, windows and balcony details are not modelled because they are not required.

## WebGL setup order

The important call order in `main.js` is:

1. get the canvas
2. call `canvas.getContext("webgl")`
3. read shader text from the HTML
4. create and compile the vertex shader
5. create and compile the fragment shader
6. create the program
7. attach both shaders
8. link the program
9. use the program
10. find attribute and uniform locations
11. create and bind the position buffer
12. describe the attribute with `gl.vertexAttribPointer()`
13. send the projection matrix
14. upload points, send uniforms and draw

WebGL does not know what a sofa or bed is. It only knows vertices, buffers, shaders, matrices, colors and draw calls.

## HTML shaders, attributes and uniforms

The vertex shader receives:

```glsl
attribute vec2 a_position;
uniform mat4 u_matrix;
uniform mat4 u_projection;
```

`a_position` is an attribute because every vertex has a different position. The matrices are uniforms because one value is sent for the complete draw call.

The fragment shader receives `u_color` and writes the final RGBA color.

This is the evolution in the project:

```text
manually add objectX and objectY to every vertex
	-> try manual translationMatrix and rotationMatrix
	-> use gl-matrix mat4 functions
	-> keep local geometry and send u_matrix to GLSL
```

The old manual attempts and spelling mistakes are still kept in the comments in `main.js` for learning.

## Buffers and attributes

```js
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
```

`createBuffer()` creates GPU storage. `bindBuffer()` makes it the current `ARRAY_BUFFER`. Later `gl.bufferData()` uploads the typed vertex array into that current buffer.

```js
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
```

This says to read two floating point values for each vertex, starting at the beginning of the bound buffer.

The same buffer is reused for rectangles, circles, arcs, lines and hitbox borders.

## Coordinates and matrices

The room uses an orthographic world from `-4` to `+4` on both axes. The center is `(0, 0)`. Browser mouse pixels are converted into this world with `mouseToWorld()`.

WebGL matrices use colum major storage. Furniture points are created around local `(0, 0)` and transformed with:

```js
mat4.translate(matrix, matrix, [x, y, 0]);
mat4.rotateZ(matrix, matrix, rotation);
mat4.scale(matrix, matrix, [scaleX, scaleY, 1]);
```

The mathematical idea is:

```text
worldPoint = T * R * S * localPoint
```

The right side applies first: scale, then rotation, then translation. The local origin is the furniture pivot, so objects rotate and scale around themselves instead of around the room.

## Local and world coordinates

The bed mattress is created in local coordinates. Pillow and blanket offsets are also local coordinates. `localToWorld()` applies the parent scale and rotation before adding the parent world position.

This is why a pillow stays attached to a bed when the bed rotates.

The shader finally calculates:

```glsl
gl_Position = u_projection * u_matrix * vec4(a_position, 0.0, 1.0);
```

The model matrix changes local coordinates into room/world coordinates. The orthographic projection changes those world coordinates into clip coordinates.

## Picking and dragging

`getObjectSize()` collects the corners of all parts of a compound object, applies scale and rotation, and calculates `left`, `right`, `bottom` and `top`.

`isPointInsideObject()` checks whether the mouse is inside those borders.

On mouse down the selected object and cursor offset are saved. On mouse move its position is updated. On mouse up dragging ends. This prevents the furniture from jumping to the cursor.

The held object's hitbox is yellow. The optional Show hitboxes button draws all hitboxes red.

This uses simple axis-aligned bounding boxes instead of color framebuffer picking. It is easier to understand and is acceptable for this assignment.

## User controls

- hold the left mouse button and drag: move furniture
- `R`: rotate selected furniture by 15 degrees
- `+`: make selected furniture bigger
- `-`: make selected furniture smaller
- `L`: randomize furniture position and rotation
- Add buttons: spawn a new furniture object
- Assign label: name the selected furniture
- Show hitboxes: display selection borders

## Three modes

### Plan mode

Add, select, drag, rotate, scale, randomize and label furniture.

### Save mode

Enter a plan name and press Save plan. The furniture array is copied to JSON and stored in browser `localStorage` under `furniturePlans`.

### Retrieve mode

Choose a saved plan and press Load plan. The saved furniture, labels, positions, rotations and scales replace the current array and the scene is redrawn.

Multiple named plans can be saved. They are local to the browser and can disappear if browser storage is cleared.

## Assignment report answers

### How do local and global coordinates switch?

Furniture is first created in local coordinates around its own origin. Its model matrix applies scale, Z rotation and translation to move it into the global room/world coordinates. Child parts use `localToWorld()` to apply the parent transform.

The full chain is:

```text
local geometry -> model matrix -> world room -> projection matrix -> clip space
```

### What would be added with more time?

- randomize the actual room partitions, not only furniture
- make doorways fixed architectural elements instead of draggable objects
- use exact polygon picking instead of approximate bounding boxes
- add collision warnings
- add undo and redo
- add export/import plan files
- add shader compile and link error messages
- add a strict `M` key mode cycle if the instructor requires it

## Honest current status

The graphics and interaction system is working. The main assignment-level limitations are that `L` randomizes furniture instead of wall partitions, and the doorway is also stored in the furniture array even though it is pre-rendered initially.

These are documented honestly rather than pretending the project is a full CAD application.

## Demo checklist

1. Open `index.html`.
2. Show the labelled room and doorway.
3. Drag furniture.
4. Hold an object and show the yellow hitbox.
5. Toggle all hitboxes.
6. Press `R`, `+`, `-` and `L`.
7. Add furniture with the buttons.
8. Assign a label.
9. Save a named plan.
10. Change the scene and retrieve the saved plan.
11. Explain local coordinates, world coordinates, colum major order and T R S.

## AI and team declaration

Each team member should complete the required AI declaration according to the course rules and state what assistance was used.

### team members

| name | student id |
| --- | --- |
| Unnath Chittimalla | IMT2023620 |
| Anish Teja Bramhajosyula | IMT2024029 |

Team task example:

```text
Member 1: WebGL setup, shaders, matrices and geometry
Member 2: UI, mouse/keyboard interaction and save/retrieve
Member 3: testing, documentation and presentation
```

## doubts we solved while building it

this section records the actual questions that came up during the project, so the readme is also a small learning diary.

### what does `canvas.getContext("webgl")` mean?

it asks the html canvas for a webgl drawing context. the returned object is the `WebGLRenderingContext`, usually stored in the variable `gl`. if the browser cannot provide webgl, the result is `null`.

### why was the furniture missing after changing the projection?

the first projection used `0` to `8`, but many furniture positions were negative. objects with negative x or y were outside the visible area. changing the orthographic view to `-4` through `+4` made the world centered around `(0, 0)`.

### why were the objects too small and in the wrong place?

the transform order was wrong at one point. scaling before translation can also scale the object's position toward zero. the useful order is `translate`, `rotatez`, then `scale` in the gl-matrix calls, because the right side is applied first to the local point.

### why did the doorway line disappear?

the doorway did not have scale values, so adding a number to `undefined` created `nan`. finite scale checks and default scale `1` fixed the door scale and the end point calculation. this was a very annoying little bug becuase the arc could still be visible while the line was not.

### why did doorway rotation break?

the arc matrix was rotated before it was translated. that made the hinge position rotate around the room origin. translating first and rotating second keeps the hinge in place and turns the arc around its own hinge.

### why could the doorway not be clicked?

the mouse coordinates were calculated with the internal canvas size instead of the displayed css size. `getBoundingClientRect()` gives the real size on the screen, so `rect.width` and `rect.height` are used for the mouse conversion.

### why was dragging needed instead of just clicking?

the requested interaction is press and hold. mouse down finds the object, mouse move changes its position, and mouse up ends the drag. a drag offset stops the object from jumping its center under the cursor.

### why are hitboxes calculated separately from drawing?

webgl draws pixels but does not automatically know which furniture was clicked. `getObjectSize()` calculates transformed borders for the compound parts, and the mouse uses those borders for simple bounding-box picking. the selected object gets a yellow border while held.

### why is there a label control?

a label is a human name for a furniture object, such as `master bed` or `living sofa`. the label is stored on the object, shown in the sidebar, and included when the plan is saved. the input stays in the html so it does not get lost when the selected text is updated.

### why did the label button not work before?

the old `updateObjectInfo()` replaced the whole information panel using `innerhtml`. that removed the label button and then tried to attach an old dom node again. now only the selection text changes, while the input and button stay connected to their event listner.

### how does saving work?

save mode takes the furniture array, copies it with json, and stores the named plan inside browser `localstorage`. each object keeps its type, label, x, y, rotation and scale. this means more than one plan can be stored under different names.

### how does loading work?

retrieve mode reads the selected name from `localstorage`, parses the json back into javascript objects, replaces the current furniture array, and calls `drawscene()`. the saved plan is local to that browser, not a server file.

### does the canvas need to start blank?

no. the assignment requires doorways to be pre-rendered, and an initial furniture layout makes the application easier to demonstrate. the user can still add more furniture, move it, rotate it, scale it, label it, save it and retrieve it.

### are the `m` and `m` mode keys strict?

the assignment gives a mode key as an example strategy. the current project uses a visible html mode selector for plan, save and retrieve. if the instructor says the keyboard mode cycle is strict, an `m` key can be added to cycle those three modes later.

### why is the coffee table circular?

the coffee table uses a center point and circle points with `gl.triangle_fan`. the old rectangle was replaced because the required design describes a circular coffee table by the sofa.

### what room layout are we matching?

the layout is an approximate version of the supplied floor plan: kitchen and dining top-left, bathroom top-right, living area bottom-left, bedroom bottom-right and entry hall near the middle. appliances, fixtures, windows and balcony details are left out because they were not required.
