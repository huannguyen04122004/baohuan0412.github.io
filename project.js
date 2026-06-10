// Add projects here. Keep file paths inside /assets/ so GitHub Pages can serve them.
window.PROJECTS = [
  {
    title: "+12V PWM Motor Speed Controller",
    year: "2026",
    description: "Finished a PWM motor speed controller PCB using KiCad as an onboarding project for CalSol. I will revisit this project in the future for any potential improvements.",
    tags: ["PCB", "Automotive"],
    image: "assets/img/project1.png",
    links: [
      { label: "Photo", url: "./PWM_3D_viewer.jpg" },
      { label: "Slides (PDF)", url: "assets/docs/project1_slides.pdf" },
      { label: "Code (GitHub)", url: "https://github.com/yourusername/yourrepo" }
    ]
  },
  {
    title: "CAN Bus Sensor",
    year: "2026",
    description: "Unfinished project designing a CAN Bus network with different type of sensors through KiCad PCB. The nodes include a coolant temp node, IMU node and GPS node. Below is a completed pcb for the coolant temp node as an example of what the other two pcb nodes look like. I will be revisiting this project in the future.",
    tags: ["PCB", "Automotive"],
    image: "assets/img/project2.png",
    links: [
      { label: "Poster (PDF)", url: "assets/docs/project2_poster.pdf" },
      { label: "Photos", url: "assets/img/project2.png" }
    ]
  },
  {
    title: "Device Physics Simulation (MOSFET Optimization)",
    year: "2025",
    description: "Designed and simulated a 25 nm gate-length NMOS transistor using Synopsys Sentaurus TCAD as part of UC Berkeley’s EE130 (Integrated-Circuit Devices) course. Built a 2D device structure with doped source/drain extensions and gate spacers, and analyzed the impact of process and geometry parameters—including channel doping, junction depth, spacer length, and oxide thickness—on device behavior. Solved coupled Poisson and carrier continuity equations to extract band diagrams, carrier concentrations, electric fields, and I–V characteristics. Evaluated key performance metrics such as threshold voltage, subthreshold behavior, short-channel effects, and on/off current tradeoffs while meeting specified design constraints.",
    tags: ["Semiconductors", "Simulation", "TCAD"],
    image: "assets/img/project3.png",
    links: [
      { label: "Write-up (PDF)", url: "./ELENG-130_230A Final Project.pdf" }
    ]
  },
  {
    title: "Thermal Driven Lava Lamp Fluid Dynamics Simulation",
    year: "2025",
    description: "Developed a physics-based lava lamp simulation in Python as a final project for EPS 109 (Computer Simulations with Jupyter Notebooks), modeling the motion of buoyant fluid “blobs” under temperature-dependent density changes. Implemented numerical simulations to capture heating, cooling, buoyancy, and viscous effects, using time-stepped updates to evolve particle positions and velocities. Visualized system behavior through animated plots, enabling analysis of emergent flow patterns and dynamic equilibrium.",
    tags: ["Python", "Simulation"],
    image: "assets/img/project3.png",
    links: [
      { label: "Write-up (PDF)", url: "assets/docs/mosfet_writeup.pdf" }
    ]
  }
  
];
