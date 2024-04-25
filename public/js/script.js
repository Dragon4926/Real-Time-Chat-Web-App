let html = `
<div class="copy">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" color="#ffffff" fill="none">
    <path d="M16.5956 20.6989L14.1508 21.3462C11.8879 21.9453 10.7564 22.2448 9.86986 21.7542C8.98333 21.2636 8.68795 20.1744 8.09718 17.996L6.63512 12.6048C6.04436 10.4264 5.74898 9.33725 6.26846 8.4744C6.78794 7.61155 7.91941 7.312 10.1824 6.7129L14.1827 5.65384C16.4457 5.05474 17.5771 4.75519 18.4637 5.2458C19.3502 5.73642 19.6456 6.82561 20.2363 9.00398L21.7042 14.4166C21.9554 15.343 22.0811 15.8062 21.943 16.2417M16.5956 20.6989C17.3477 20.4998 17.3537 20.4966 17.9386 19.9948L20.6824 17.6404C21.4308 16.9983 21.805 16.6772 21.943 16.2417M16.5956 20.6989C16.5956 20.6989 17.1837 16.1058 18.5 15.5C19.9932 14.8128 21.943 16.2417 21.943 16.2417" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M17 5.00118C16.9356 3.92779 16.7573 3.2521 16.2484 2.76762C15.4689 2.02553 14.218 2.02184 11.716 2.01444L7.29321 2.00137C4.79129 1.99398 3.54033 1.99028 2.76535 2.72777C1.99037 3.46526 1.99402 4.65592 2.00132 7.03725L2.01938 12.9307C2.02668 15.3121 2.03033 16.5027 2.80984 17.2448C3.58935 17.9869 4.84031 17.9906 7.34224 17.998L8.02306 18" stroke="currentColor" stroke-width="1.5" />
  </svg>
</div>
<div class="joinBtn">
  <button type="button" id="joinButton">Join</button>
</div>`;

let html2 = ` <ul id="messages"></ul>
<form id="form" action="">
    <div class="add">

        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" color="#000000" fill="none">
            <path d="M2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path d="M4.64856 5.07876C4.7869 4.93211 4.92948 4.7895 5.0761 4.65111M7.94733 2.72939C8.12884 2.6478 8.31313 2.57128 8.5 2.5M2.5 8.5C2.57195 8.31127 2.64925 8.12518 2.73172 7.94192" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M12 8V16M16 12L8 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    </div>
  <input id="input" autocomplete="off" /><button>Send</button>
</form>`;

let html3 = ` <form id="form2" action="/codeCheck">
<input type="number" id="input2"><button type="submit">Join</button>
</form>`;
window.addEventListener("DOMContentLoaded", () => {
  let create = document.body.getElementsByClassName("create")[0];
  create.addEventListener("click", async () => {
    let roomId = document.createElement("h3");
    let roomCode = document.createElement("p");
    roomId.classList.add("margin-left");
    roomCode.classList.add("margin-left");
    roomCode.classList.add("CODE");
    roomId.innerText = "Room Id:";
    let main = document.getElementsByTagName("main")[0];
    let object = document.createElement("div");
    object.classList.add("object");
    main.insertAdjacentElement("beforeend", object);

    async function roomcode() {
      let a = await fetch("/event");
      let b = await a.text();
      return b;
    }

    const roomCodeValue = await roomcode();
    roomCode.innerText = roomCodeValue;
    object.append(roomId);
    object.append(roomCode);
    object.innerHTML += html;

    const copyButton = object.querySelector(".copy");
    const copiedMessage = document.createElement("span");
    copiedMessage.textContent = "Copied!";
    copiedMessage.style.display = "none";
    copiedMessage.style.fontSize = "12px";
    copiedMessage.style.color = "black";
    object.appendChild(copiedMessage);

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(roomCodeValue);
        copiedMessage.style.display = "inline";
        setTimeout(() => {
          copiedMessage.style.display = "none";
        }, 1000);
      } catch (err) {
        console.error("Failed to copy room code: ", err);
      }
    });

    let joinbutton = document.querySelector(".joinBtn button");
    joinbutton.addEventListener("click", async () => {
      try {
        const roomCodeElement = document.querySelector(".CODE");
        if (roomCodeElement) {
          const roomCodeValue = roomCodeElement.textContent;
          if (roomCodeValue.trim() === "") {
            console.error("Room code is missing");
            return;
          }
          const url = `/joinroom?roomcode=${roomCodeValue}`;
          let response = await fetch(url);
          if (response.ok) {
            let status = await response.text();
            console.log(status);
            const currentRoom =
              document.getElementsByClassName("mainContent")[0];
            currentRoom.innerHTML = html2;
            const jr = document.getElementsByClassName("joinedroom")[0];
            jr.innerText = "Joined: " + roomCodeValue;
            const socket = io();
            const form = document.getElementById("form");
            const input = document.getElementById("input");
            const messages = document.getElementById("messages");

            form.addEventListener("submit", (e) => {
              e.preventDefault();
              if (input.value) {
                socket.emit("chat message", input.value);
                input.value = "";
              }
            });
            socket.on("chat message", (msg) => {
              const item = document.createElement("li");
              item.textContent = msg;
              messages.appendChild(item);
              // window.scrollTo(0, document.body.scrollHeight);
            });
          } else {
            console.error("Error:", response.status);
          }
        } else {
          console.error("Room code element not found");
          return;
        }
      } catch (error) {
        console.error("Fetch error:", error);
      }
    });
  });
  let jerbtn = document.body.getElementsByClassName("join")[0];
  let joinexistroom = document.getElementsByClassName("joinExistRoom")[0];
  jerbtn.addEventListener("click", async () => {
    joinexistroom.innerHTML = html3;
    const form = document.getElementById("form2");

    form.addEventListener("submit", async (event) => {
      event.preventDefault(); // Prevent the default form submission behavior

      const input = document.getElementById("input2");
      const number = input.value;

      try {
        const response = await fetch("/codeCheck", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ number }),
        });

        if (response.ok) {
          console.log("Valid Room Code");

          const currentRoom = document.getElementsByClassName("mainContent")[0];
          currentRoom.innerHTML = html2;
          const jr = document.getElementsByClassName("joinedroom")[0];
          jr.innerText = "Joined: " + number;
          const socket = io();
          const form = document.getElementById("form");
          const input = document.getElementById("input");
          const messages = document.getElementById("messages");

          form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (input.value) {
              socket.emit("chat message", input.value);
              input.value = "";
            }
          });
          socket.on("chat message", (msg) => {
            const item = document.createElement("li");
            item.textContent = msg;
            messages.appendChild(item);
          });

        } else if (response.status === 400) {
          const message = await response.text();
          if (message === "wrong code") {
            console.log("Wrong code entered");
            // Display an error message to the user or take any other appropriate action
          }
        } else {
          console.error("Error:", response.status);
        }
      } catch (error) {
        console.error("Fetch error:", error);
      }
    });
  });
});
