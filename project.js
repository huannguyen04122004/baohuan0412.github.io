/*
  PROJECT DATA
  ------------
  Each project is one object in the list below. The page builds itself from this list,
  so to add a project, copy one block, paste it where you want it to appear, and edit it.

  category  – must be one of: "PCB design", "Semiconductor devices", "Software & simulation"
  status    – optional, e.g. "In progress" or "Complete"
  org       – optional, the team, course or company it was for
  summary   – one or two sentences shown on the card
  details   – the full write-up, shown when someone clicks "Read full description"
  specs     – key numbers, shown as a small datasheet-style table: [ ["Label", "Value"], ... ]
  tags      – tools and skills
  cover     – the card image (put images in assets/img/cards/)
  gallery   – photos that open in the viewer when the card image is clicked
  links     – reports, schematics, live demos, videos

  Watch the commas: every block ends with "}," and every line inside ends with ",".
  A missing comma stops the whole page from loading.
*/
window.PROJECTS = [
  {
    title: "MPPT Interface PCB",
    category: "PCB design",
    year: "2026",
    status: "In progress",
    org: "CalSol Solar Vehicle Team",
    summary:
      "Bridges four solar MPPT controllers on a 500 kbps CAN bus to the car's 1 Mbps main bus, with 24 V to 12 V power conversion on the same board.",
    details:
      "The Gen11 MPPT Interface PCB bridges communication between four Maximum Power Point Trackers (MPPTs), operating at 500 kbps, and the vehicle's main CAN bus, operating at 1 Mbps. This lets the rest of the vehicle's CAN network run at the higher speed without being limited by the MPPTs. The board interfaces with an ESP32-S3 development board, which handles CAN message forwarding and translation. The PCB also provides 24 V to 12 V power conversion and protection circuitry to support the MPPTs.",
    specs: [
      ["MPPT bus", "500 kbps CAN"],
      ["Vehicle bus", "1 Mbps CAN"],
      ["Controllers bridged", "4 MPPTs"],
      ["Power stage", "24 V → 12 V"],
      ["Controller", "ESP32-S3"]
    ],
    tags: ["KiCad", "CAN bus", "ESP32-S3", "Embedded systems", "Power electronics"],
    cover: "assets/img/cards/mppt.webp",
    gallery: [
      { src: "MPPT_Interface_3D_viewer.png", caption: "KiCad 3D view with the ESP32-S3 board mounted" },
      { src: "MPPT_Interface_floorplan.png", caption: "PCB layout" }
    ],
    links: [{ label: "Schematic (PDF)", url: "MPPT_Interface_schematic.pdf" }]
  },
  {
    title: "+12 V PWM Motor Speed Controller",
    category: "PCB design",
    year: "2026",
    status: "Complete",
    org: "CalSol Solar Vehicle Team",
    summary:
      "A 12 V PWM motor speed controller board, designed in KiCad as my onboarding project for CalSol.",
    details:
      "Finished a PWM motor speed controller PCB in KiCad as an onboarding project for CalSol. I plan to revisit this design for future improvements.",
    specs: [
      ["Supply", "+12 V"],
      ["Speed control", "PWM"],
      ["Purpose", "CalSol onboarding"]
    ],
    tags: ["KiCad", "PCB layout", "Automotive"],
    cover: "assets/img/cards/pwm.webp",
    gallery: [
      { src: "PWM_3D_viewer.jpg", caption: "KiCad 3D view" },
      { src: "PWM_floorplan.jpg", caption: "PCB layout" }
    ],
    links: []
  },
  {
    title: "CAN Bus Sensor Network",
    category: "PCB design",
    year: "2026",
    status: "In progress",
    summary:
      "My first PCB project: a CAN network of sensor nodes for coolant temperature, IMU and GPS data. The coolant temperature node is fully laid out.",
    details:
      "My first PCB design: a CAN bus network of sensor nodes, designed in KiCad. The planned nodes are a coolant temperature node, an IMU node and a GPS node. The coolant temperature node is complete and shown here as an example of what the other two boards will look like. I plan to come back and finish the rest of the network.",
    specs: [
      ["Network", "CAN bus"],
      ["Nodes", "Coolant temp, IMU, GPS"],
      ["Completed", "Coolant temp node"]
    ],
    tags: ["KiCad", "CAN bus", "Sensors", "Automotive"],
    cover: "assets/img/cards/can-temp.webp",
    gallery: [
      { src: "Temp_3D_viewer.jpeg", caption: "Coolant temperature node, KiCad 3D view" },
      { src: "Temp_floorplan.jpeg", caption: "Coolant temperature node, PCB layout" }
    ],
    links: []
  },
  {
    title: "NMOS Integrated Circuit Fabrication",
    category: "Semiconductor devices",
    year: "2026",
    status: "Complete",
    org: "EE143, UC Berkeley",
    summary:
      "Built an NMOS integrated circuit from a bare p-type silicon wafer in Berkeley's cleanroom, then electrically characterized the transistors.",
    details:
      "Fabricated an NMOS integrated circuit on a p-type silicon wafer in a semiconductor cleanroom, producing MOSFETs, logic gates and test structures over a semester-long process in UC Berkeley's EE143 (Microfabrication Technology). The process covered photolithography, thermal oxidation, wet etching, dopant diffusion, polysilicon deposition and aluminum metallization. Afterwards I electrically characterized the finished devices and test structures.",
    specs: [
      ["Substrate", "p-type Si wafer"],
      ["Built", "MOSFETs, logic gates, test structures"],
      ["Interconnect", "Aluminum"]
    ],
    tags: ["Photolithography", "Thermal oxidation", "Etching", "Dopant diffusion", "Deposition", "Metallization", "Mask alignment"],
    cover: "assets/img/cards/nmos.webp",
    gallery: [
      { src: "assets/img/figures/nmos-actv-poly-marks.webp", caption: "Active and poly layer alignment marks under the microscope" },
      { src: "assets/img/figures/nmos-cont-metl-marks.webp", caption: "Contact and metal layer alignment marks" },
      { src: "assets/img/figures/nmos-cross-section.webp", caption: "Cross-section sketch of the finished transistor" },
      { src: "assets/img/figures/nmos-id-vd.webp", caption: "Measured I–V curves of a fabricated NMOS device" }
    ],
    links: [
      { label: "Fabrication report (PDF)", url: "EE143 – NMOS Microfabrication & Process Characterization.pdf" },
      { label: "Electrical characterization (PDF)", url: "EE143 – Semiconductor Device Electrical Characterization.pdf" }
    ]
  },
  {
    title: "GaAs Heterojunction Solar Cell",
    category: "Semiconductor devices",
    year: "2026",
    status: "Complete",
    org: "EE134, UC Berkeley",
    summary:
      "Designed and optimized a multilayer GaAs heterojunction solar cell in AFORS-HET, reaching a simulated 25.04% power conversion efficiency.",
    details:
      "Designed and simulated a multilayer GaAs heterojunction solar cell using AFORS-HET, optimizing semiconductor layer thickness, emitter doping and metal contacts to improve device performance. Analyzed energy band diagrams, I–V characteristics and carrier recombination to evaluate efficiency. Parameter sweeps reached a simulated power conversion efficiency of 25.04%, with an open-circuit voltage of 1.107 V and a fill factor of 87.73%. Compared the results with published experimental data to assess device performance and the limits of the model.",
    specs: [
      ["Efficiency", "25.04%"],
      ["Open-circuit voltage", "1.107 V"],
      ["Fill factor", "87.73%"]
    ],
    tags: ["AFORS-HET", "Photovoltaics", "Band diagrams", "I–V characterization"],
    cover: "assets/img/cards/gaas.webp",
    gallery: [{ src: "assets/img/figures/gaas-iv.webp", caption: "Simulated I–V curve of the optimized cell" }],
    links: [{ label: "Report (PDF)", url: "EE134 Final Project.pdf" }]
  },
  {
    title: "25 nm NMOSFET Design in TCAD",
    category: "Semiconductor devices",
    year: "2025",
    status: "Complete",
    org: "EE130, UC Berkeley",
    summary:
      "Designed a 25 nm gate-length NMOS transistor in Synopsys Sentaurus and tuned its doping and geometry to meet the design constraints.",
    details:
      "Designed and simulated a 25 nm gate-length NMOS transistor using Synopsys Sentaurus TCAD in UC Berkeley's EE130 (Integrated-Circuit Devices). Built a 2D device structure with doped source/drain extensions and gate spacers, and analyzed how channel doping, junction depth, spacer length and oxide thickness affect device behavior. Solved coupled Poisson and carrier continuity equations to extract band diagrams, carrier concentrations, electric fields and I–V characteristics. Evaluated threshold voltage, subthreshold behavior, short-channel effects and on/off current tradeoffs while meeting the specified design constraints.",
    specs: [
      ["Gate length", "25 nm"],
      ["Simulator", "Sentaurus TCAD"],
      ["Tuned", "Doping, junction depth, spacers, oxide"]
    ],
    tags: ["Sentaurus TCAD", "Device physics", "Short-channel effects"],
    cover: "assets/img/cards/tcad.webp",
    gallery: [
      { src: "assets/img/figures/tcad-id-vg.webp", caption: "I–V comparison for 1 nm and 3 nm effective oxide thickness" },
      { src: "assets/img/figures/tcad-id-vd.webp", caption: "Drain current vs. drain voltage at four gate biases" }
    ],
    links: [{ label: "Write-up (PDF)", url: "ELENG-130_230A Final Project.pdf" }]
  },
  {
    title: "FreshTrack",
    category: "Software & simulation",
    year: "2026",
    status: "Live",
    summary:
      "A shared inventory tracker that shows food-service staff what is about to expire, so less prepared product goes to waste.",
    details:
      "FreshTrack is a multi-user food inventory and expiration tracking web app that helps employees keep track of prepared products and reduce expired inventory. Users create accounts, record product names, storage locations, and preparation and expiration times, mark items as completed, and review or delete completed entries. It uses Supabase for authentication and a shared PostgreSQL database, with Row Level Security enabled to protect the data.",
    specs: [
      ["Front end", "JavaScript"],
      ["Back end", "Supabase, PostgreSQL"],
      ["Security", "Row Level Security"]
    ],
    tags: ["JavaScript", "Supabase", "PostgreSQL", "Authentication"],
    cover: "assets/img/cards/freshtrack.webp",
    gallery: [{ src: "FreshTrack.png", caption: "FreshTrack dashboard" }],
    links: [{ label: "Open the app (sign-up required)", url: "https://huannguyen04122004.github.io/freshtrack/" }]
  },
  {
    title: "Lava Lamp Fluid Simulation",
    category: "Software & simulation",
    year: "2025",
    status: "Complete",
    org: "EPS 109, UC Berkeley",
    summary:
      "A Python physics simulation of lava lamp blobs rising and sinking as heating and cooling change their density.",
    details:
      "Developed a physics-based lava lamp simulation in Python for EPS 109 (Computer Simulations with Jupyter Notebooks), modeling the motion of buoyant fluid blobs under temperature-dependent density changes. Implemented time-stepped numerical simulations to capture heating, cooling, buoyancy and viscous effects, updating particle positions and velocities each step. Visualized the system with animated plots to study emergent flow patterns and dynamic equilibrium.",
    specs: [
      ["Language", "Python"],
      ["Physics", "Buoyancy, heat transfer, viscosity"],
      ["Method", "Time-stepped simulation"]
    ],
    tags: ["Python", "Jupyter", "Numerical methods"],
    cover: "https://i.ytimg.com/vi/N0FGvnUgUw4/hqdefault.jpg",
    coverFit: "contain",
    coverLink: "https://youtube.com/shorts/N0FGvnUgUw4",
    gallery: [],
    links: [{ label: "Watch the simulation", url: "https://youtube.com/shorts/N0FGvnUgUw4" }]
  }
];
